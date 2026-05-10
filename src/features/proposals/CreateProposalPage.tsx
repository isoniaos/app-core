import type { FormEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type { Address, Bytes32Hash, ProposalDto } from "@isonia/types";
import { ProposalType } from "@isonia/types";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import {
  buildDemoSetNumberAction,
  CREATE_PROPOSAL_TYPES,
  GOV_PROPOSALS_ABI,
  isBytes32Hash,
  parseProposalCreatedLog,
  proposalTypeToChainCode,
} from "../../chain/proposal-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import { useTransactionModal, type TransactionFlowStage } from "../../transactions";
import { formatAddress, formatLabel } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import {
  useWalletConnection,
  type WalletConnection,
} from "../../wallet/useWalletConnection";

type TargetMode = "demo" | "custom";

type TransactionStage =
  | "idle"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "indexed"
  | "failed";

interface FormState {
  readonly proposalType: ProposalType;
  readonly title: string;
  readonly descriptionUri: string;
  readonly targetMode: TargetMode;
  readonly targetAddress: string;
  readonly value: string;
  readonly demoNumber: string;
  readonly dataHash: string;
}

type ProposalFormField =
  | "proposalType"
  | "title"
  | "targetAddress"
  | "value"
  | "demoNumber"
  | "dataHash";

type ProposalFormErrors = Partial<Record<ProposalFormField, string>>;
type ProposalFormTouched = Partial<Record<ProposalFormField, boolean>>;

interface TransactionState {
  readonly stage: TransactionStage;
  readonly txHash?: `0x${string}`;
  readonly proposalId?: string;
  readonly error?: string;
}

interface CreateProposalPayload {
  readonly orgId: bigint;
  readonly proposalTypeCode: number;
  readonly targetAddress: Address;
  readonly value: bigint;
  readonly dataHash: Bytes32Hash;
  readonly metadataUri: string;
}

const INDEXER_POLL_INTERVAL_MS = 1_500;
const INDEXER_TIMEOUT_MS = 60_000;

export function CreateProposalPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const client = useIsoniaClient();
  const navigate = useNavigate();
  const account = useWalletConnection();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const {
    openSingle: openTransactionModal,
    updateItem: updateTransactionModalItem,
  } = useTransactionModal();
  const orgId = requireParam(useParams().orgId, "orgId");
  const demoTargetAddress = runtimeConfig.contracts.demoTargetAddress;
  const activeTransactionModalItemId = useRef<string | undefined>(undefined);
  const [form, setForm] = useState<FormState>(() => ({
    proposalType: ProposalType.Standard,
    title: "",
    descriptionUri: "",
    targetMode: demoTargetAddress ? "demo" : "custom",
    targetAddress: "",
    value: "0",
    demoNumber: "",
    dataHash: "",
  }));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<ProposalFormTouched>({});
  const [transaction, setTransaction] = useState<TransactionState>({
    stage: "idle",
  });

  const writeFlowEnabled =
    runtimeConfig.features.writeActions &&
    runtimeConfig.features.createProposal;
  const demoActionPreview = useMemo(
    () => previewDemoAction(orgId, form.demoNumber),
    [orgId, form.demoNumber],
  );
  const formErrors = useMemo(
    () => validateForm(form, orgId, demoTargetAddress),
    [demoTargetAddress, form, orgId],
  );
  const visibleErrors = useMemo(
    () => getVisibleErrors(formErrors, touched, submitAttempted),
    [formErrors, submitAttempted, touched],
  );
  const blockingNotice = getBlockingNotice({
    account,
    publicClientReady: Boolean(publicClient),
    runtimeChainId: runtimeConfig.chainId,
    writeFlowEnabled,
  });
  const isSubmitting =
    transaction.stage === "wallet_pending" ||
    transaction.stage === "submitted" ||
    transaction.stage === "confirming" ||
    transaction.stage === "confirmed_waiting_indexer";

  const markTouched = (field: ProposalFormField): void => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const executeCreateProposal = useCallback(
    async (payload: CreateProposalPayload, itemId: string): Promise<void> => {
      activeTransactionModalItemId.current = itemId;
      const setCreateTransaction = (
        next: TransactionState,
        patch: {
          readonly retry?: () => Promise<void> | void;
          readonly retryLabel?: string;
        } = {},
      ): void => {
        setTransaction(next);
        updateTransactionModalItem(itemId, {
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          error: next.error,
          retry: undefined,
          retryLabel: undefined,
          stage: mapCreateProposalStageToTransactionFlowStage(next.stage),
          txHash: next.txHash,
          ...patch,
        });
      };
      const fail = (
        error: string,
        txHash?: `0x${string}`,
        proposalId?: string,
      ): void => {
        setCreateTransaction(
          {
            error,
            proposalId,
            stage: "failed",
            txHash,
          },
          {
            retry: () => executeCreateProposal(payload, itemId),
            retryLabel: "Retry create",
          },
        );
      };

      if (!writeFlowEnabled) {
        fail("Create proposal is disabled by runtime config.");
        return;
      }

      if (!account.isConnected || !account.address) {
        fail("Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        fail(
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        );
        return;
      }

      if (!publicClient) {
        fail("Wallet client is unavailable for the configured chain.");
        return;
      }

      let txHash: `0x${string}` | undefined;
      let proposalId: string | undefined;
      try {
        setCreateTransaction({ stage: "wallet_pending" });
        txHash = await writeContractAsync({
          address: runtimeConfig.contracts.govProposalsAddress,
          abi: GOV_PROPOSALS_ABI,
          functionName: "createProposal",
          args: [
            payload.orgId,
            payload.proposalTypeCode,
            payload.targetAddress,
            payload.value,
            payload.dataHash,
            payload.metadataUri,
          ],
          chainId: runtimeConfig.chainId,
        });

        setCreateTransaction({ stage: "submitted", txHash });
        setCreateTransaction({ stage: "confirming", txHash });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== "success") {
          throw new Error("Transaction failed on-chain.");
        }

        const created = parseProposalCreatedLog(
          receipt,
          runtimeConfig.contracts.govProposalsAddress,
        );

        if (!created || created.orgId !== orgId) {
          throw new Error(
            "Transaction confirmed, but ProposalCreated was not found in the receipt.",
          );
        }

        proposalId = created.proposalId;
        setCreateTransaction({
          stage: "confirmed_waiting_indexer",
          txHash,
          proposalId: created.proposalId,
        });
        await waitForIndexedProposal(client, orgId, created.proposalId);

        setCreateTransaction({
          stage: "indexed",
          txHash,
          proposalId: created.proposalId,
        });
        await delay(350);
        navigate(`/orgs/${orgId}/proposals/${created.proposalId}`);
      } catch (error: unknown) {
        fail(normalizeTransactionError(error), txHash, proposalId);
      }
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      client,
      navigate,
      orgId,
      publicClient,
      runtimeConfig.blockExplorerUrl,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govProposalsAddress,
      updateTransactionModalItem,
      writeContractAsync,
      writeFlowEnabled,
    ],
  );

  async function submitProposal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitAttempted(true);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    const payload = buildPayload(form, orgId, demoTargetAddress);
    if (payload instanceof Error) {
      setTransaction({ stage: "failed", error: payload.message });
      return;
    }

    const itemId = buildCreateProposalTransactionModalItemId(orgId);
    activeTransactionModalItemId.current = itemId;
    setTransaction({ stage: "idle" });
    openTransactionModal({
      description:
        "Create the proposal on-chain, then wait for Control Plane to index the ProposalCreated event.",
      item: {
        blockExplorerUrl: runtimeConfig.blockExplorerUrl,
        description: `${formatLabel(form.proposalType)} proposal for org #${orgId}`,
        execute: () => executeCreateProposal(payload, itemId),
        executeLabel: "Create",
        id: itemId,
        stage: "idle",
        title: "Create proposal",
      },
      title: "Create proposal",
    });
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Create Proposal"
        description="Submit a proposal to the configured GovProposals contract and wait for the indexed read model."
      />

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}/proposals`}>
          Back to proposals
        </Link>
        <StatusBadge tone={writeFlowEnabled ? "success" : "muted"}>
          {writeFlowEnabled ? "Writes enabled" : "Writes disabled"}
        </StatusBadge>
      </div>

      {blockingNotice ? (
        <div className="inline-state inline-state-muted write-flow-alert">
          <strong>{blockingNotice.title}</strong>
          <span>{blockingNotice.message}</span>
        </div>
      ) : null}

      <form className="proposal-form" onSubmit={submitProposal}>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Proposal Metadata</h2>
              <p className="panel-subtitle">
                Title is written as the metadata fallback when no URI is set.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <label className={formFieldClassName(visibleErrors.proposalType)}>
              <RequiredLabel>Proposal type</RequiredLabel>
              <select
                value={form.proposalType}
                onBlur={() => markTouched("proposalType")}
                onChange={(event) =>
                  setForm({
                    ...form,
                    proposalType: event.target.value as ProposalType,
                  })
                }
              >
                {CREATE_PROPOSAL_TYPES.map((proposalType) => (
                  <option key={proposalType} value={proposalType}>
                    {formatLabel(proposalType)}
                  </option>
                ))}
              </select>
              <FieldError message={visibleErrors.proposalType} />
            </label>

            <label className={formFieldClassName(visibleErrors.title)}>
              <RequiredLabel>Title</RequiredLabel>
              <input
                autoComplete="off"
                maxLength={120}
                type="text"
                value={form.title}
                onBlur={() => markTouched("title")}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
              <FieldError message={visibleErrors.title} />
            </label>

            <label className="form-field form-field-wide">
              <span>Description URI</span>
              <input
                autoComplete="off"
                placeholder="ipfs://proposal-metadata"
                type="text"
                value={form.descriptionUri}
                onChange={(event) =>
                  setForm({ ...form, descriptionUri: event.target.value })
                }
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Execution Action</h2>
              <p className="panel-subtitle">
                Store the target, value, and data hash for this proposal.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field form-field-wide">
              <span>Target mode</span>
              <div className="segmented-control" role="group">
                <button
                  className={segmentClassName(form.targetMode === "demo")}
                  disabled={!demoTargetAddress}
                  type="button"
                  onClick={() => setForm({ ...form, targetMode: "demo" })}
                >
                  Current configured target
                </button>
                <button
                  className={segmentClassName(form.targetMode === "custom")}
                  type="button"
                  onClick={() => setForm({ ...form, targetMode: "custom" })}
                >
                  Custom data hash
                </button>
              </div>
            </div>

            <label className={formFieldClassName(visibleErrors.targetAddress, true)}>
              <RequiredLabel>Target address</RequiredLabel>
              <input
                autoComplete="off"
                readOnly={form.targetMode === "demo"}
                type="text"
                value={
                  form.targetMode === "demo"
                    ? demoTargetAddress ?? ""
                    : form.targetAddress
                }
                onChange={(event) =>
                  setForm({ ...form, targetAddress: event.target.value })
                }
                onBlur={() => markTouched("targetAddress")}
              />
              <FieldError message={visibleErrors.targetAddress} />
            </label>

            <label className={formFieldClassName(visibleErrors.value)}>
              <RequiredLabel>Value (wei)</RequiredLabel>
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={form.value}
                onBlur={() => markTouched("value")}
                onChange={(event) =>
                  setForm({ ...form, value: event.target.value })
                }
              />
              <FieldError message={visibleErrors.value} />
            </label>

            {form.targetMode === "demo" ? (
              <>
                <label className={formFieldClassName(visibleErrors.demoNumber)}>
                  <RequiredLabel>setNumber value</RequiredLabel>
                  <input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={form.demoNumber}
                    onBlur={() => markTouched("demoNumber")}
                    onChange={(event) =>
                      setForm({ ...form, demoNumber: event.target.value })
                    }
                  />
                  <FieldError message={visibleErrors.demoNumber} />
                </label>
                <label className="form-field form-field-wide">
                  <span>Data hash</span>
                  <input
                    className="mono-input"
                    readOnly
                    type="text"
                    value={demoActionPreview?.dataHash ?? ""}
                  />
                </label>
              </>
            ) : (
              <label className={formFieldClassName(visibleErrors.dataHash, true)}>
                <RequiredLabel>Data hash</RequiredLabel>
                <input
                  autoComplete="off"
                  className="mono-input"
                  placeholder="0x..."
                  type="text"
                  value={form.dataHash}
                  onBlur={() => markTouched("dataHash")}
                  onChange={(event) =>
                    setForm({ ...form, dataHash: event.target.value })
                  }
                />
                <FieldError message={visibleErrors.dataHash} />
              </label>
            )}
          </div>
        </section>

        <CreateProposalTransactionStatus
          blockExplorerUrl={runtimeConfig.blockExplorerUrl}
          transaction={transaction}
        />

        <div className="action-row proposal-form-actions">
          <button
            className="button button-primary"
            disabled={isSubmitting || Boolean(blockingNotice)}
            type="submit"
          >
            {isSubmitting ? "Submitting" : "Create proposal"}
          </button>
          {account.address ? (
            <span className="form-muted">
              Wallet {formatAddress(account.address)}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function CreateProposalTransactionStatus({
  blockExplorerUrl,
  transaction,
}: {
  readonly blockExplorerUrl?: string;
  readonly transaction: TransactionState;
}): JSX.Element {
  return (
    <section className="proposal-transaction-status-card">
      <div>
        <strong>Transaction status</strong>
        <span>{transactionSummary(transaction)}</span>
        {transaction.txHash || transaction.stage === "confirmed_waiting_indexer" || transaction.stage === "failed" ? (
          <div className="proposal-action-status-meta">
            {transaction.txHash ? (
              <span className="technical-code">{transaction.txHash}</span>
            ) : null}
            {blockExplorerUrl && transaction.txHash ? (
              <a
                className="diagnostics-text-link"
                href={`${blockExplorerUrl.replace(/\/+$/, "")}/tx/${transaction.txHash}`}
                rel="noreferrer"
                target="_blank"
              >
                View transaction
              </a>
            ) : null}
            {transaction.stage === "confirmed_waiting_indexer" ||
            transaction.stage === "failed" ? (
              <Link className="diagnostics-text-link" to="/diagnostics">
                View diagnostics
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <StatusBadge tone={transactionTone(transaction.stage)}>
        {formatLabel(transaction.stage)}
      </StatusBadge>
    </section>
  );
}

function RequiredLabel({
  children,
}: {
  readonly children: string;
}): JSX.Element {
  return (
    <span>
      {children}
      <span aria-hidden="true" className="field-required-marker">
        *
      </span>
    </span>
  );
}

function FieldError({
  message,
}: {
  readonly message?: string;
}): JSX.Element | null {
  return message ? <span className="form-field-error-message">{message}</span> : null;
}

function formFieldClassName(error: string | undefined, wide = false): string {
  return [
    "form-field",
    wide ? "form-field-wide" : "",
    error ? "form-field-error" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function validateForm(
  form: FormState,
  orgId: string,
  demoTargetAddress: Address | undefined,
): ProposalFormErrors {
  const errors: ProposalFormErrors = {};

  if (!formValue(form.proposalType)) {
    errors.proposalType = "Proposal type is required.";
  }

  if (!formValue(form.title)) {
    errors.title = "Title is required.";
  }

  if (parseUint(formValue(orgId), "Organization ID") instanceof Error) {
    errors.title = "Organization ID is not valid.";
  }

  const value = parseUint(form.value, "Value");
  if (value instanceof Error) {
    errors.value = value.message;
  }

  if (form.targetMode === "demo") {
    if (!demoTargetAddress) {
      errors.targetAddress = "Configured target address is missing.";
    }
    const number = parseUint(form.demoNumber, "setNumber value");
    if (number instanceof Error) {
      errors.demoNumber = number.message;
    }
    return errors;
  }

  const targetAddress = formValue(form.targetAddress);
  if (!targetAddress) {
    errors.targetAddress = "Target address is required.";
  } else if (!isAddress(targetAddress)) {
    errors.targetAddress = "Target address must be a valid EVM address.";
  }

  const dataHash = formValue(form.dataHash);
  if (!dataHash) {
    errors.dataHash = "Data hash is required.";
  } else if (!isBytes32Hash(dataHash)) {
    errors.dataHash = "Data hash must be a 32-byte 0x-prefixed hash.";
  }

  return errors;
}

function getVisibleErrors(
  errors: ProposalFormErrors,
  touched: ProposalFormTouched,
  submitAttempted: boolean,
): ProposalFormErrors {
  if (submitAttempted) {
    return errors;
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched[field as ProposalFormField]),
  ) as ProposalFormErrors;
}

function buildCreateProposalTransactionModalItemId(orgId: string): string {
  return `proposal-create:${orgId}`;
}

function mapCreateProposalStageToTransactionFlowStage(
  stage: TransactionStage,
): TransactionFlowStage {
  if (stage === "indexed") {
    return "completed";
  }
  return stage;
}

function buildPayload(
  form: FormState,
  orgId: string,
  demoTargetAddress: Address | undefined,
): CreateProposalPayload | Error {
  const parsedOrgId = parseUint(formValue(orgId), "Organization ID");
  if (parsedOrgId instanceof Error) {
    return parsedOrgId;
  }

  const value = parseUint(form.value, "Value");
  if (value instanceof Error) {
    return value;
  }

  const title = formValue(form.title);
  if (!title) {
    return new Error("Title is required.");
  }

  const metadataUri = formValue(form.descriptionUri) || title;
  const proposalTypeCode = safeProposalTypeCode(form.proposalType);
  if (proposalTypeCode instanceof Error) {
    return proposalTypeCode;
  }

  if (form.targetMode === "demo") {
    if (!demoTargetAddress) {
      return new Error("Configured target address is missing from runtime config.");
    }
    const demoNumber = parseUint(form.demoNumber, "setNumber value");
    if (demoNumber instanceof Error) {
      return demoNumber;
    }
    return {
      orgId: parsedOrgId,
      proposalTypeCode,
      targetAddress: demoTargetAddress,
      value,
      dataHash: buildDemoSetNumberAction(parsedOrgId, demoNumber).dataHash,
      metadataUri,
    };
  }

  const targetAddress = formValue(form.targetAddress);
  if (!isAddress(targetAddress)) {
    return new Error("Target address must be a valid EVM address.");
  }

  const dataHash = formValue(form.dataHash);
  if (!isBytes32Hash(dataHash)) {
    return new Error("Data hash must be a 32-byte 0x-prefixed hash.");
  }

  return {
    orgId: parsedOrgId,
    proposalTypeCode,
    targetAddress,
    value,
    dataHash,
    metadataUri,
  };
}

function previewDemoAction(
  orgId: string,
  demoNumber: string,
): { readonly dataHash: Bytes32Hash } | undefined {
  const parsedOrgId = parseUint(formValue(orgId), "Organization ID");
  const parsedDemoNumber = parseUint(demoNumber, "setNumber value");

  if (parsedOrgId instanceof Error || parsedDemoNumber instanceof Error) {
    return undefined;
  }

  return {
    dataHash: buildDemoSetNumberAction(parsedOrgId, parsedDemoNumber).dataHash,
  };
}

function safeProposalTypeCode(proposalType: ProposalType): number | Error {
  try {
    return proposalTypeToChainCode(proposalType);
  } catch (error: unknown) {
    return toError(error);
  }
}

async function waitForIndexedProposal(
  client: IsoniaControlPlaneClient,
  orgId: string,
  proposalId: string,
): Promise<ProposalDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      return await client.getProposal(orgId, proposalId);
    } catch (error: unknown) {
      lastError = toError(error);
      await delay(INDEXER_POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    `Indexer timeout: proposal #${proposalId} did not appear in the API within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function parseUint(value: string, label: string): bigint | Error {
  if (!/^\d+$/.test(value)) {
    return new Error(`${label} must be a non-negative integer.`);
  }

  try {
    return BigInt(value);
  } catch {
    return new Error(`${label} is too large.`);
  }
}

function formValue(value: string): string {
  return value.trim();
}

function segmentClassName(active: boolean): string {
  return active ? "segment segment-active" : "segment";
}

function getBlockingNotice({
  account,
  publicClientReady,
  runtimeChainId,
  writeFlowEnabled,
}: {
  readonly account: WalletConnection;
  readonly publicClientReady: boolean;
  readonly runtimeChainId: number;
  readonly writeFlowEnabled: boolean;
}): { readonly title: string; readonly message: string } | undefined {
  if (!writeFlowEnabled) {
    return {
      title: "Write flow disabled",
      message: "Enable features.writeActions and features.createProposal.",
    };
  }

  if (!account.isConnected) {
    return {
      title: "Wallet not connected",
      message: "Connect a wallet before submitting a proposal.",
    };
  }

  if (account.chainId !== runtimeChainId) {
    return {
      title: "Wrong chain",
      message: `Connected chain ${String(
        account.chainId,
      )}; expected chain ${runtimeChainId}.`,
    };
  }

  if (!publicClientReady) {
    return {
      title: "Protocol client unavailable",
      message: "The configured chain client is not ready.",
    };
  }

  return undefined;
}

function transactionSummary(transaction: TransactionState): string {
  if (transaction.stage === "failed") {
    return transaction.error ?? "The transaction could not be completed.";
  }
  if (transaction.proposalId) {
    return `Proposal #${transaction.proposalId}`;
  }
  if (transaction.txHash) {
    return transaction.txHash;
  }
  return "No transaction submitted yet.";
}

function transactionTone(
  stage: TransactionStage,
): "default" | "success" | "warning" | "danger" | "muted" {
  if (stage === "indexed") {
    return "success";
  }
  if (stage === "failed") {
    return "danger";
  }
  if (stage === "idle") {
    return "muted";
  }
  return "warning";
}

function normalizeTransactionError(error: unknown): string {
  const message = getErrorMessage(error);
  if (/user rejected|rejected request|denied transaction/i.test(message)) {
    return "Wallet transaction was rejected.";
  }
  return message;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.shortMessage === "string") {
      return record.shortMessage;
    }
    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return "Unknown transaction error.";
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}
