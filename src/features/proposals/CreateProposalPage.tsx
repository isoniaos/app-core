import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type { Address, Bytes32Hash, ProposalDto } from "@isonia/types";
import { ProposalType } from "@isonia/types";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
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
import { formatAddress, formatLabel } from "../../utils/format";
import { requireParam } from "../../utils/route-params";

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
  const account = useAccount();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const orgId = requireParam(useParams().orgId, "orgId");
  const demoTargetAddress = runtimeConfig.contracts.demoTargetAddress;
  const [form, setForm] = useState<FormState>(() => ({
    proposalType: ProposalType.Standard,
    title: "",
    descriptionUri: "",
    targetMode: demoTargetAddress ? "demo" : "custom",
    targetAddress: "",
    value: "0",
    demoNumber: "101",
    dataHash: "",
  }));
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

  async function submitProposal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!writeFlowEnabled) {
      setTransaction({
        stage: "failed",
        error: "Create proposal is disabled by runtime config.",
      });
      return;
    }

    if (!account.isConnected || !account.address) {
      setTransaction({
        stage: "failed",
        error: "Wallet is not connected.",
      });
      return;
    }

    if (account.chainId !== runtimeConfig.chainId) {
      setTransaction({
        stage: "failed",
        error: `Wallet is connected to chain ${String(
          account.chainId,
        )}; expected chain ${runtimeConfig.chainId}.`,
      });
      return;
    }

    if (!publicClient) {
      setTransaction({
        stage: "failed",
        error: "Wallet client is unavailable for the configured chain.",
      });
      return;
    }

    const payload = buildPayload(form, orgId, demoTargetAddress);
    if (payload instanceof Error) {
      setTransaction({ stage: "failed", error: payload.message });
      return;
    }

    try {
      setTransaction({ stage: "wallet_pending" });
      const txHash = await writeContractAsync({
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

      setTransaction({ stage: "submitted", txHash });
      setTransaction({ stage: "confirming", txHash });
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

      setTransaction({
        stage: "confirmed_waiting_indexer",
        txHash,
        proposalId: created.proposalId,
      });
      await waitForIndexedProposal(client, orgId, created.proposalId);

      setTransaction({
        stage: "indexed",
        txHash,
        proposalId: created.proposalId,
      });
      await delay(350);
      navigate(`/orgs/${orgId}/proposals/${created.proposalId}`);
    } catch (error: unknown) {
      setTransaction({
        stage: "failed",
        error: normalizeTransactionError(error),
      });
    }
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
            <label className="form-field">
              <span>Proposal type</span>
              <select
                value={form.proposalType}
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
            </label>

            <label className="form-field">
              <span>Title</span>
              <input
                autoComplete="off"
                maxLength={120}
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
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
              <h2>Action Anchor</h2>
              <p className="panel-subtitle">
                Demo mode anchors DemoTarget.setNumber; custom mode accepts an
                existing target and data hash only.
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
                  Demo target
                </button>
                <button
                  className={segmentClassName(form.targetMode === "custom")}
                  type="button"
                  onClick={() => setForm({ ...form, targetMode: "custom" })}
                >
                  Custom target
                </button>
              </div>
            </div>

            <label className="form-field form-field-wide">
              <span>Target address</span>
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
              />
            </label>

            <label className="form-field">
              <span>Value</span>
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={form.value}
                onChange={(event) =>
                  setForm({ ...form, value: event.target.value })
                }
              />
            </label>

            {form.targetMode === "demo" ? (
              <>
                <label className="form-field">
                  <span>Demo number</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={form.demoNumber}
                    onChange={(event) =>
                      setForm({ ...form, demoNumber: event.target.value })
                    }
                  />
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
              <label className="form-field form-field-wide">
                <span>Data hash</span>
                <input
                  autoComplete="off"
                  className="mono-input"
                  placeholder="0x..."
                  type="text"
                  value={form.dataHash}
                  onChange={(event) =>
                    setForm({ ...form, dataHash: event.target.value })
                  }
                />
              </label>
            )}
          </div>
        </section>

        <TransactionLifecycle transaction={transaction} />

        <div className="action-row proposal-form-actions">
          <button
            className="button button-primary"
            disabled={isSubmitting}
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

function TransactionLifecycle({
  transaction,
}: {
  readonly transaction: TransactionState;
}): JSX.Element {
  const steps = [
    {
      id: "wallet_pending",
      title: "Wallet pending",
      detail: "Transaction request is open in the connected wallet.",
    },
    {
      id: "submitted",
      title: "Submitted",
      detail: transaction.txHash
        ? `Hash ${transaction.txHash}`
        : "Waiting for transaction hash.",
    },
    {
      id: "confirming",
      title: "Confirming",
      detail: "Waiting for an on-chain receipt.",
    },
    {
      id: "confirmed_waiting_indexer",
      title: "Confirmed, waiting for indexer",
      detail: transaction.proposalId
        ? `Proposal #${transaction.proposalId} was emitted on-chain.`
        : "Receipt confirmed and indexer polling is active.",
    },
    {
      id: "indexed",
      title: "Indexed",
      detail: "Control Plane returned the new proposal.",
    },
  ] satisfies readonly {
    readonly id: Exclude<TransactionStage, "idle" | "failed">;
    readonly title: string;
    readonly detail: string;
  }[];

  return (
    <section className="panel transaction-panel">
      <div className="panel-header">
        <div>
          <h2>Transaction</h2>
          <p className="panel-subtitle">{transactionSummary(transaction)}</p>
        </div>
        <StatusBadge tone={transactionTone(transaction.stage)}>
          {formatLabel(transaction.stage)}
        </StatusBadge>
      </div>
      <div className="transaction-steps">
        {transaction.stage === "idle" ? (
          <TransactionStep
            active
            detail="Ready for proposal input."
            title="Idle"
          />
        ) : null}
        {steps.map((step) => (
          <TransactionStep
            active={isTransactionStepActive(transaction.stage, step.id)}
            complete={isTransactionStepComplete(transaction.stage, step.id)}
            detail={step.detail}
            key={step.id}
            title={step.title}
          />
        ))}
        {transaction.stage === "failed" ? (
          <TransactionStep
            active
            danger
            detail={transaction.error ?? "The proposal transaction failed."}
            title="Failed"
          />
        ) : null}
      </div>
    </section>
  );
}

function TransactionStep({
  active,
  complete,
  danger,
  detail,
  title,
}: {
  readonly active?: boolean;
  readonly complete?: boolean;
  readonly danger?: boolean;
  readonly detail: string;
  readonly title: string;
}): JSX.Element {
  const className = [
    "transaction-step",
    active ? "transaction-step-active" : "",
    complete ? "transaction-step-complete" : "",
    danger ? "transaction-step-danger" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
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
      return new Error("Demo target address is missing from runtime config.");
    }
    const demoNumber = parseUint(form.demoNumber, "Demo number");
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
  const parsedDemoNumber = parseUint(demoNumber, "Demo number");

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
  readonly account: ReturnType<typeof useAccount>;
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

function isTransactionStepActive(
  current: TransactionStage,
  step: Exclude<TransactionStage, "idle" | "failed">,
): boolean {
  return current === step;
}

function isTransactionStepComplete(
  current: TransactionStage,
  step: Exclude<TransactionStage, "idle" | "failed">,
): boolean {
  const order: Record<Exclude<TransactionStage, "idle" | "failed">, number> = {
    wallet_pending: 1,
    submitted: 2,
    confirming: 3,
    confirmed_waiting_indexer: 4,
    indexed: 5,
  };
  return current !== "failed" && current !== "idle" && order[current] > order[step];
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
