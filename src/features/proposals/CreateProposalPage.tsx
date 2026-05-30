import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type { Address, Bytes32Hash, ProposalDto } from "@isonia/types";
import { ProposalType } from "@isonia/types";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress, type Abi, type Hex } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import {
  formatDecodedContractError,
  getErrorMessage,
} from "../../chain/contract-error-decoder";
import {
  CREATE_PROPOSAL_TYPES,
  ISO_PROPOSALS_ABI,
  LOCAL_DEMO_TARGET_ABI,
  parseProposalCreatedLog,
  proposalTypeToChainCode,
} from "../../chain/proposal-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";
import {
  buildActionDataPreview,
  coerceAbiLiteral,
  formatAbiParameterLabel,
  formatReadResultValue,
  getAbiInputs,
  getAbiOutputs,
  getCompatibleReadResults,
  parseContractAbiJson,
  parseProposalActionValue,
  type ParsedContractAbi,
  type ParsedContractFunction,
  type ReadResultValue,
} from "../known-contracts/abi/contract-abi";
import {
  useKnownContracts,
  type KnownContractRecord,
} from "../known-contracts/known-contracts-storage";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import { IsoIcon } from "../../ui-kit";
import { useTransactionModal, type TransactionFlowStage } from "../../transactions";
import { formatAddress, formatLabel } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import {
  useWalletConnection,
  type WalletConnection,
} from "../../wallet/useWalletConnection";

interface FormState {
  readonly proposalType: ProposalType;
  readonly title: string;
  readonly descriptionUri: string;
  readonly value: string;
}

interface ContractOption {
  readonly abiJson: string;
  readonly address: Address;
  readonly chainId: number;
  readonly id: string;
  readonly name: string;
  readonly parsedAbi: ParsedContractAbi;
  readonly source: "local" | "runtime-demo";
}

interface ParameterFormState {
  readonly literalValue: string;
  readonly mode: "literal" | "readResult";
  readonly readResultId?: string;
}

interface CapturedReadResult extends ReadResultValue {
  readonly contractId: string;
  readonly contractName: string;
  readonly formattedValue: string;
  readonly observedAt: string;
}

type TransactionStage =
  | "idle"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "indexed"
  | "failed";

interface TransactionState {
  readonly stage: TransactionStage;
  readonly txHash?: `0x${string}`;
  readonly proposalId?: string;
  readonly error?: string;
}

interface CreateProposalPayload {
  readonly actionData: string;
  readonly actionSelector: Hex;
  readonly contractName: string;
  readonly dataHash: Bytes32Hash;
  readonly functionSignature: string;
  readonly metadataUri: string;
  readonly orgId: bigint;
  readonly proposalTypeCode: number;
  readonly targetAddress: Address;
  readonly value: bigint;
}

interface BuildArgsResult {
  readonly args: readonly unknown[];
  readonly errors: readonly string[];
}

interface ReadExecutionState {
  readonly error?: string;
  readonly loading: boolean;
}

const INDEXER_POLL_INTERVAL_MS = 1_500;
const INDEXER_TIMEOUT_MS = 60_000;

export function CreateProposalPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const client = useIsoniaClient();
  const navigate = useNavigate();
  const account = useWalletConnection();
  const publicClient = usePublicClient({ chainId: runtimeConfig.activeDeployment.chainId });
  const { writeContractAsync } = useWriteContract();
  const {
    openSingle: openTransactionModal,
    updateItem: updateTransactionModalItem,
  } = useTransactionModal();
  const orgId = requireParam(useParams().orgId, "orgId");
  const chainId = runtimeConfig.activeDeployment.chainId;
  const localDemoTargetAddress = runtimeConfig.activeDeployment.localDemoTargetAddress;
  const knownContracts = useKnownContracts(orgId, chainId);
  const activeTransactionModalItemId = useRef<string | undefined>(undefined);
  const [form, setForm] = useState<FormState>(() => ({
    proposalType: ProposalType.Standard,
    title: "",
    descriptionUri: "",
    value: "0",
  }));
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedFunctionSignature, setSelectedFunctionSignature] = useState("");
  const [parameters, setParameters] = useState<Record<string, ParameterFormState>>({});
  const [readResults, setReadResults] = useState<readonly CapturedReadResult[]>([]);
  const [readExecution, setReadExecution] = useState<ReadExecutionState>({
    loading: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [transaction, setTransaction] = useState<TransactionState>({
    stage: "idle",
  });

  const contractOptions = useMemo(
    () =>
      buildContractOptions({
        chainId,
        knownContracts: knownContracts.contracts,
        localDemoTargetAddress,
      }),
    [chainId, knownContracts.contracts, localDemoTargetAddress],
  );
  const selectedContract = contractOptions.find(
    (contract) => contract.id === selectedContractId,
  );
  const selectedFunction = selectedContract?.parsedAbi.functions.find(
    (fn) => fn.signature === selectedFunctionSignature,
  );
  const selectedInputs = selectedFunction
    ? getAbiInputs(selectedFunction.abiItem)
    : [];
  const argsResult = useMemo(
    () =>
      selectedFunction
        ? buildFunctionArguments({
            fn: selectedFunction,
            parameters,
            readResults,
          })
        : { args: [], errors: ["Choose a contract function."] },
    [parameters, readResults, selectedFunction],
  );
  const valueResult = useMemo(
    () =>
      selectedFunction
        ? parseProposalActionValue(selectedFunction, form.value)
        : 0n,
    [form.value, selectedFunction],
  );
  const actionPreview = useMemo(() => {
    if (!selectedFunction || selectedFunction.kind !== "writable") {
      return undefined;
    }
    if (argsResult.errors.length > 0) {
      return argsResult.errors[0];
    }
    const preview = buildActionDataPreview({
      args: argsResult.args,
      fn: selectedFunction,
    });
    return preview instanceof Error ? preview.message : preview;
  }, [argsResult, selectedFunction]);
  const proposalErrors = useMemo(
    () =>
      validateProposalForm({
        actionPreview,
        argsResult,
        contractOptions,
        form,
        selectedContract,
        selectedFunction,
        valueResult,
      }),
    [
      actionPreview,
      argsResult,
      contractOptions,
      form,
      selectedContract,
      selectedFunction,
      valueResult,
    ],
  );

  useEffect(() => {
    if (
      selectedContractId &&
      contractOptions.some((contract) => contract.id === selectedContractId)
    ) {
      return;
    }

    setSelectedContractId(contractOptions[0]?.id ?? "");
  }, [contractOptions, selectedContractId]);

  useEffect(() => {
    const functions = selectedContract?.parsedAbi.functions ?? [];
    if (
      selectedFunctionSignature &&
      functions.some((fn) => fn.signature === selectedFunctionSignature)
    ) {
      return;
    }

    setSelectedFunctionSignature(functions[0]?.signature ?? "");
  }, [selectedContract, selectedFunctionSignature]);

  useEffect(() => {
    if (!selectedFunction) {
      setParameters({});
      return;
    }

    setReadExecution({ loading: false });
    setParameters((current) => {
      const next: Record<string, ParameterFormState> = {};

      getAbiInputs(selectedFunction.abiItem).forEach((input, index) => {
        const key = parameterKey(selectedFunction.signature, index);
        next[key] =
          current[key] ??
          {
            literalValue: defaultLiteralValue(input, orgId),
            mode: "literal",
          };
      });

      return next;
    });
  }, [orgId, selectedFunction]);

  const writeFlowEnabled =
    runtimeConfig.features.writeActions &&
    runtimeConfig.features.createProposal;
  const blockingNotice = getBlockingNotice({
    account,
    publicClientReady: Boolean(publicClient),
    runtimeChainId: runtimeConfig.activeDeployment.chainId,
    writeFlowEnabled,
  });
  const isSubmitting =
    transaction.stage === "wallet_pending" ||
    transaction.stage === "submitted" ||
    transaction.stage === "confirming" ||
    transaction.stage === "confirmed_waiting_indexer";
  const visibleProposalErrors = submitAttempted ? proposalErrors : [];

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
          blockExplorerUrl: runtimeConfig.activeDeployment.blockExplorerUrl,
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

      const signerAddress = account.address;
      if (!account.isConnected || !signerAddress) {
        fail("Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.activeDeployment.chainId) {
        fail(
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.activeDeployment.chainId}.`,
        );
        return;
      }

      if (!publicClient) {
        fail("Wallet client is unavailable for the configured chain.");
        return;
      }

      const isoProposalsAddress =
        runtimeConfig.activeDeployment.contracts.isoProposalsAddress;
      if (!isoProposalsAddress || !isAddress(isoProposalsAddress)) {
        fail("IsoProposals contract address is missing from runtime config.");
        return;
      }

      let txHash: `0x${string}` | undefined;
      let proposalId: string | undefined;
      try {
        setCreateTransaction({ stage: "wallet_pending" });
        const createProposalArgs = buildCreateProposalContractArgs(payload);
        await publicClient.simulateContract({
          address: isoProposalsAddress,
          abi: ISO_PROPOSALS_ABI,
          functionName: "createProposal",
          args: createProposalArgs,
          account: signerAddress,
        });
        const estimatedGas = await publicClient.estimateContractGas({
          address: isoProposalsAddress,
          abi: ISO_PROPOSALS_ABI,
          functionName: "createProposal",
          args: createProposalArgs,
          account: signerAddress,
        });
        txHash = await writeContractAsync({
          address: isoProposalsAddress,
          abi: ISO_PROPOSALS_ABI,
          functionName: "createProposal",
          args: createProposalArgs,
          chainId: runtimeConfig.activeDeployment.chainId,
          account: signerAddress,
          gas: addGasMargin(estimatedGas),
        });

        setCreateTransaction({ stage: "submitted", txHash });
        setCreateTransaction({ stage: "confirming", txHash });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== "success") {
          throw new Error("Transaction failed on-chain.");
        }

        const created = parseProposalCreatedLog(receipt, isoProposalsAddress);

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
        fail(normalizeTransactionError(error, [ISO_PROPOSALS_ABI]), txHash, proposalId);
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
      runtimeConfig.activeDeployment.blockExplorerUrl,
      runtimeConfig.activeDeployment.chainId,
      runtimeConfig.activeDeployment.contracts.isoProposalsAddress,
      updateTransactionModalItem,
      writeContractAsync,
      writeFlowEnabled,
    ],
  );

  async function runReadFunction(): Promise<void> {
    if (!selectedContract || !selectedFunction || selectedFunction.kind !== "readable") {
      return;
    }

    const args = buildFunctionArguments({
      fn: selectedFunction,
      parameters,
      readResults,
    });
    if (args.errors.length > 0) {
      setReadExecution({ error: args.errors[0], loading: false });
      return;
    }

    if (!publicClient) {
      setReadExecution({
        error: "The configured chain client is not ready.",
        loading: false,
      });
      return;
    }

    setReadExecution({ loading: true });
    try {
      const result = await publicClient.readContract({
        address: selectedContract.address,
        abi: [selectedFunction.abiItem] as Abi,
        functionName: selectedFunction.name,
        args: args.args,
      });
      const outputs = getAbiOutputs(selectedFunction.abiItem);
      const values = splitReadResult(result, outputs.length);
      const now = new Date().toISOString();
      const captured = outputs.map((output, index) => ({
        contractId: selectedContract.id,
        contractName: selectedContract.name,
        formattedValue: formatReadResultValue(values[index]),
        functionLabel: selectedFunction.displayLabel,
        functionSignature: selectedFunction.signature,
        id: `${now}:${selectedContract.id}:${selectedFunction.signature}:${index}`,
        observedAt: now,
        outputIndex: index,
        outputName: output.name,
        type: output.type,
        value: values[index],
      }));

      setReadResults((current) => [...captured, ...current].slice(0, 24));
      setReadExecution({ loading: false });
    } catch (error: unknown) {
      setReadExecution({
        error: normalizeTransactionError(error, [selectedContract.parsedAbi.abi]),
        loading: false,
      });
    }
  }

  async function submitProposal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitAttempted(true);

    if (proposalErrors.length > 0) {
      return;
    }

    const payload = buildPayload({
      actionPreview,
      form,
      orgId,
      selectedContract,
      selectedFunction,
      valueResult,
    });
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
        blockExplorerUrl: runtimeConfig.activeDeployment.blockExplorerUrl,
        description: `${payload.contractName} ${payload.functionSignature}`,
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
        description="Build a proposal action from a local known-contract ABI, submit target/value/actionSelector/dataHash, and wait for the indexed read model."
      />

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}/proposals`}>
          Back to proposals
        </Link>
        <Link className="button" to={`/orgs/${orgId}/settings`}>
          Organization settings
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
              <RequiredLabel>Proposal type</RequiredLabel>
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
              <RequiredLabel>Title</RequiredLabel>
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
              <h2>Execution Action</h2>
              <p className="panel-subtitle">
                ABI records are local App Core configuration. The protocol stores
                target, value, actionSelector, and dataHash.
              </p>
            </div>
            {selectedFunction ? <FunctionKindBadge fn={selectedFunction} /> : null}
          </div>

          {contractOptions.length === 0 ? (
            <div className="inline-state inline-state-muted">
              <strong>No known contracts available</strong>
              <span>
                Add a known contract ABI in organization settings for chain
                {` ${chainId}`} before building proposal actions.
              </span>
              <Link className="diagnostics-text-link" to={`/orgs/${orgId}/settings`}>
                Open organization settings
              </Link>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <RequiredLabel>Known contract</RequiredLabel>
                  <select
                    value={selectedContractId}
                    onChange={(event) => {
                      setSelectedContractId(event.target.value);
                      setSubmitAttempted(false);
                    }}
                  >
                    {contractOptions.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.name} - {formatAddress(contract.address)}
                        {contract.source === "runtime-demo"
                          ? " (runtime config)"
                          : ""}
                      </option>
                    ))}
                  </select>
                  {selectedContract ? (
                    <span className="form-help-text">
                      Chain {selectedContract.chainId}; target{" "}
                      {selectedContract.address}
                    </span>
                  ) : null}
                </label>

                <label className="form-field form-field-wide">
                  <RequiredLabel>Function</RequiredLabel>
                  <select
                    value={selectedFunctionSignature}
                    onChange={(event) => {
                      setSelectedFunctionSignature(event.target.value);
                      setSubmitAttempted(false);
                    }}
                  >
                    {selectedContract?.parsedAbi.functions.map((fn) => (
                      <option key={fn.signature} value={fn.signature}>
                        {fn.kind === "readable" ? "Read" : "Write"} -{" "}
                        {fn.fullLabel}
                      </option>
                    ))}
                  </select>
                  {selectedFunction ? (
                    <FunctionCatalog
                      functions={selectedContract?.parsedAbi.functions ?? []}
                      selectedSignature={selectedFunction.signature}
                    />
                  ) : null}
                </label>
              </div>

              {selectedFunction ? (
                <ActionBuilderFields
                  chainSymbol={runtimeConfig.activeDeployment.nativeCurrencySymbol}
                  fn={selectedFunction}
                  formValue={form.value}
                  inputs={selectedInputs}
                  onRunRead={() => {
                    void runReadFunction();
                  }}
                  onSetFormValue={(value) => setForm({ ...form, value })}
                  onSetParameter={(index, value) =>
                    setParameters((current) => ({
                      ...current,
                      [parameterKey(selectedFunction.signature, index)]: value,
                    }))
                  }
                  parameters={parameters}
                  readExecution={readExecution}
                  readResults={readResults}
                  selectedContract={selectedContract}
                />
              ) : null}

              <ReadResultsPanel
                readResults={readResults}
                writableFunctions={selectedContract?.parsedAbi.functions.filter(
                  (fn) => fn.kind === "writable",
                ) ?? []}
              />

              {selectedFunction?.kind === "writable" &&
              selectedContract &&
              actionPreview &&
              typeof actionPreview !== "string" ? (
                <ActionPreviewPanel
                  actionData={actionPreview.actionData}
                  actionSelector={actionPreview.actionSelector}
                  dataHash={actionPreview.dataHash}
                  fn={selectedFunction}
                  selectedContract={selectedContract}
                  value={
                    valueResult instanceof Error
                      ? "Invalid value"
                      : selectedFunction.payable
                        ? valueResult.toString()
                        : "0"
                  }
                />
              ) : null}

              {visibleProposalErrors.length > 0 ? (
                <div className="inline-state inline-state-danger">
                  <strong>Cannot create proposal</strong>
                  <span>{visibleProposalErrors[0]}</span>
                </div>
              ) : null}
            </>
          )}
        </section>

        <CreateProposalTransactionStatus
          blockExplorerUrl={runtimeConfig.activeDeployment.blockExplorerUrl}
          transaction={transaction}
        />

        <div className="action-row proposal-form-actions">
          <button
            className="button button-primary"
            disabled={
              isSubmitting ||
              Boolean(blockingNotice) ||
              !selectedFunction ||
              selectedFunction.kind !== "writable" ||
              contractOptions.length === 0
            }
            type="submit"
          >
            {isSubmitting ? "Submitting" : "Create proposal"}
          </button>
          {selectedFunction?.kind === "readable" ? (
            <span className="form-muted">
              Read functions can be executed here, but are not proposal actions
              in v1.
            </span>
          ) : null}
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

function ActionBuilderFields({
  chainSymbol,
  fn,
  formValue,
  inputs,
  onRunRead,
  onSetFormValue,
  onSetParameter,
  parameters,
  readExecution,
  readResults,
  selectedContract,
}: {
  readonly chainSymbol: string;
  readonly fn: ParsedContractFunction;
  readonly formValue: string;
  readonly inputs: ReturnType<typeof getAbiInputs>;
  readonly onRunRead: () => void;
  readonly onSetFormValue: (value: string) => void;
  readonly onSetParameter: (index: number, value: ParameterFormState) => void;
  readonly parameters: Record<string, ParameterFormState>;
  readonly readExecution: ReadExecutionState;
  readonly readResults: readonly CapturedReadResult[];
  readonly selectedContract?: ContractOption;
}): JSX.Element {
  return (
    <div className="abi-builder-stack">
      {inputs.length === 0 ? (
        <div className="inline-state inline-state-muted">
          <strong>No function inputs</strong>
          <span>This ABI function does not require parameters.</span>
        </div>
      ) : (
        <section className="abi-parameter-panel">
          <div className="panel-header abi-subheader">
            <div>
              <h3>Parameters</h3>
              <p className="panel-subtitle">
                Literal values are validated before encoding. Compatible read
                outputs can be used as write parameters.
              </p>
            </div>
          </div>
          <div className="abi-parameter-list">
            {inputs.map((input, index) => (
              <ParameterRow
                fn={fn}
                index={index}
                input={input}
                key={`${fn.signature}:${index}`}
                onChange={(next) => onSetParameter(index, next)}
                readResults={readResults}
                value={
                  parameters[parameterKey(fn.signature, index)] ?? {
                    literalValue: defaultLiteralValue(input, ""),
                    mode: "literal",
                  }
                }
              />
            ))}
          </div>
        </section>
      )}

      {fn.payable ? (
        <label className="form-field abi-value-field">
          <RequiredLabel>Value (wei)</RequiredLabel>
          <input
            inputMode="numeric"
            min="0"
            type="number"
            value={formValue}
            onChange={(event) => onSetFormValue(event.target.value)}
          />
          <span className="form-help-text">
            Payable function. Native currency symbol: {chainSymbol}.
          </span>
        </label>
      ) : fn.kind === "writable" ? (
        <div className="inline-state inline-state-muted">
          <strong>Value forced to zero</strong>
          <span>Selected write function is nonpayable, so proposal value is 0 wei.</span>
        </div>
      ) : null}

      {fn.kind === "readable" ? (
        <section className="abi-read-panel">
          <div className="inline-state inline-state-muted">
            <strong>Read-only function</strong>
            <span>
              Run this read against {selectedContract?.name ?? "the selected contract"}.
              Captured outputs stay in page state and can feed compatible write
              parameters.
            </span>
          </div>
          <div className="action-row">
            <button
              className="button button-primary"
              disabled={readExecution.loading}
              type="button"
              onClick={onRunRead}
            >
              {readExecution.loading ? "Running read" : "Run read"}
            </button>
            {readExecution.error ? (
              <span className="form-field-error-message">{readExecution.error}</span>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ParameterRow({
  fn,
  index,
  input,
  onChange,
  readResults,
  value,
}: {
  readonly fn: ParsedContractFunction;
  readonly index: number;
  readonly input: ReturnType<typeof getAbiInputs>[number];
  readonly onChange: (next: ParameterFormState) => void;
  readonly readResults: readonly CapturedReadResult[];
  readonly value: ParameterFormState;
}): JSX.Element {
  const compatibleResults = getCompatibleReadResults(input.type, readResults);
  const unsupported = !fn.supportedInputs && !isParameterSupported(input.type);

  return (
    <div className="abi-parameter-row">
      <div className="abi-parameter-label">
        <strong>{formatAbiParameterLabel(input, index)}</strong>
        {unsupported ? (
          <span>{input.type} is unsupported in v1.</span>
        ) : value.mode === "readResult" && value.readResultId ? (
          <span>{formatReadResultSource(value.readResultId, compatibleResults)}</span>
        ) : (
          <span>Literal parameter value.</span>
        )}
      </div>
      <div className="abi-parameter-controls">
        <label className="form-field">
          <span>Source</span>
          <select
            disabled={unsupported}
            value={value.mode}
            onChange={(event) => {
              const mode = event.target.value as ParameterFormState["mode"];
              onChange({
                ...value,
                mode,
                readResultId:
                  mode === "readResult"
                    ? compatibleResults[0]?.id
                    : value.readResultId,
              });
            }}
          >
            <option value="literal">Literal</option>
            <option disabled={compatibleResults.length === 0} value="readResult">
              Read result
            </option>
          </select>
        </label>
        {value.mode === "readResult" ? (
          <label className="form-field">
            <span>Read output</span>
            <select
              disabled={compatibleResults.length === 0}
              value={value.readResultId ?? ""}
              onChange={(event) =>
                onChange({ ...value, readResultId: event.target.value })
              }
            >
              {compatibleResults.length === 0 ? (
                <option value="">No compatible read results</option>
              ) : null}
              {compatibleResults.map((result) => (
                <option key={result.id} value={result.id}>
                  {result.functionLabel}.{result.outputName || result.outputIndex}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="form-field">
            <span>Value</span>
            {input.type === "bool" ? (
              <select
                disabled={unsupported}
                value={value.literalValue || "false"}
                onChange={(event) =>
                  onChange({ ...value, literalValue: event.target.value })
                }
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : (
              <input
                autoComplete="off"
                className={isMonoAbiType(input.type) ? "mono-input" : undefined}
                disabled={unsupported}
                type={isIntegerAbiType(input.type) ? "number" : "text"}
                value={value.literalValue}
                onChange={(event) =>
                  onChange({ ...value, literalValue: event.target.value })
                }
              />
            )}
          </label>
        )}
      </div>
    </div>
  );
}

function FunctionCatalog({
  functions,
  selectedSignature,
}: {
  readonly functions: readonly ParsedContractFunction[];
  readonly selectedSignature: string;
}): JSX.Element {
  return (
    <div className="abi-function-catalog">
      {functions.map((fn) => (
        <span
          className={[
            "abi-function-chip",
            `abi-function-chip-${fn.kind}`,
            fn.signature === selectedSignature ? "abi-function-chip-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={fn.signature}
        >
          <IsoIcon name={fn.kind === "readable" ? "view" : "write"} size={15} />
          {fn.displayLabel}
        </span>
      ))}
    </div>
  );
}

function FunctionKindBadge({
  fn,
}: {
  readonly fn: ParsedContractFunction;
}): JSX.Element {
  const readable = fn.kind === "readable";
  return (
    <span
      className={`abi-function-kind-badge abi-function-kind-badge-${fn.kind}`}
    >
      <IsoIcon name={readable ? "view" : "write"} size={16} />
      {readable ? "Readable" : fn.payable ? "Writable payable" : "Writable"}
    </span>
  );
}

function ReadResultsPanel({
  readResults,
  writableFunctions,
}: {
  readonly readResults: readonly CapturedReadResult[];
  readonly writableFunctions: readonly ParsedContractFunction[];
}): JSX.Element | null {
  if (readResults.length === 0) {
    return null;
  }

  return (
    <section className="abi-read-results">
      <div className="panel-header abi-subheader">
        <div>
          <h3>Read Results</h3>
          <p className="panel-subtitle">
            Results are held only in this page state and are not written to
            browser storage.
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Output</th>
              <th>Type</th>
              <th>Value</th>
              <th>Parameter use</th>
            </tr>
          </thead>
          <tbody>
            {readResults.map((result) => (
              <tr key={result.id}>
                <td>
                  <strong>{result.functionLabel}</strong>
                  <span className="table-subtext">
                    {result.outputName || `output ${result.outputIndex}`}
                  </span>
                </td>
                <td>{result.type}</td>
                <td className="mono-value">{result.formattedValue}</td>
                <td>
                  <StatusBadge
                    tone={isUsableReadResult(result, writableFunctions) ? "success" : "muted"}
                  >
                    {isUsableReadResult(result, writableFunctions)
                      ? "Usable as parameter"
                      : "No compatible write input"}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionPreviewPanel({
  actionData,
  actionSelector,
  dataHash,
  fn,
  selectedContract,
  value,
}: {
  readonly actionData: string;
  readonly actionSelector: string;
  readonly dataHash: Bytes32Hash;
  readonly fn: ParsedContractFunction;
  readonly selectedContract: ContractOption;
  readonly value: string;
}): JSX.Element {
  return (
    <section className="abi-action-preview">
      <div className="panel-header abi-subheader">
        <div>
          <h3>Technical Preview</h3>
          <p className="panel-subtitle">
            The protocol stores target, value, actionSelector, and dataHash. ABI
            labels and parameter names are local App Core configuration and are
            not protocol authority.
          </p>
        </div>
      </div>
      <dl className="technical-detail-grid">
        <div>
          <dt>Target address</dt>
          <dd>{selectedContract.address}</dd>
        </div>
        <div>
          <dt>Function signature</dt>
          <dd>{fn.signature}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd>{value} wei</dd>
        </div>
        <div>
          <dt>Action selector</dt>
          <dd>{actionSelector}</dd>
        </div>
        <div>
          <dt>Data hash</dt>
          <dd>{dataHash}</dd>
        </div>
        <div>
          <dt>Contract source</dt>
          <dd>
            {selectedContract.source === "runtime-demo"
              ? "Runtime local demo target"
              : "Browser-local known contract"}
          </dd>
        </div>
      </dl>
      <details className="technical-disclosure abi-action-data">
        <summary>Action data</summary>
        <textarea className="mono-input" readOnly value={actionData} />
      </details>
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
        {transaction.txHash ||
        transaction.stage === "confirmed_waiting_indexer" ||
        transaction.stage === "failed" ? (
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

function buildContractOptions({
  chainId,
  knownContracts,
  localDemoTargetAddress,
}: {
  readonly chainId: number;
  readonly knownContracts: readonly KnownContractRecord[];
  readonly localDemoTargetAddress?: Address;
}): readonly ContractOption[] {
  const persisted = knownContracts.flatMap((record): ContractOption[] => {
    const parsedAbi = parseContractAbiJson(record.abiJson);
    if (parsedAbi instanceof Error) {
      return [];
    }

    return [
      {
        abiJson: record.abiJson,
        address: record.address,
        chainId: record.chainId,
        id: record.id,
        name: record.name,
        parsedAbi,
        source: "local",
      },
    ];
  });

  if (!localDemoTargetAddress) {
    return persisted;
  }

  const demoAbiJson = JSON.stringify(LOCAL_DEMO_TARGET_ABI, null, 2);
  const demoAbi = parseContractAbiJson(demoAbiJson);
  if (demoAbi instanceof Error) {
    return persisted;
  }

  return [
    ...persisted,
    {
      abiJson: demoAbiJson,
      address: localDemoTargetAddress,
      chainId,
      id: "runtime-local-demo-target",
      name: "Local demo target (runtime config)",
      parsedAbi: demoAbi,
      source: "runtime-demo",
    },
  ];
}

function buildFunctionArguments({
  fn,
  parameters,
  readResults,
}: {
  readonly fn: ParsedContractFunction;
  readonly parameters: Record<string, ParameterFormState>;
  readonly readResults: readonly CapturedReadResult[];
}): BuildArgsResult {
  const args: unknown[] = [];
  const errors: string[] = [];

  getAbiInputs(fn.abiItem).forEach((input, index) => {
    const key = parameterKey(fn.signature, index);
    const parameter = parameters[key];

    if (!isParameterSupported(input.type)) {
      errors.push(`${formatAbiParameterLabel(input, index)} is unsupported in v1.`);
      return;
    }

    if (!parameter) {
      errors.push(`${formatAbiParameterLabel(input, index)} is missing.`);
      return;
    }

    if (parameter.mode === "readResult") {
      const result = readResults.find((item) => item.id === parameter.readResultId);
      if (!result) {
        errors.push(`${formatAbiParameterLabel(input, index)} needs a read result.`);
        return;
      }
      if (
        !getCompatibleReadResults(input.type, [result]).some(
          (item) => item.id === result.id,
        )
      ) {
        errors.push(`${formatAbiParameterLabel(input, index)} read result type is incompatible.`);
        return;
      }
      args.push(result.value);
      return;
    }

    const coerced = coerceAbiLiteral(input.type, parameter.literalValue);
    if (coerced instanceof Error) {
      errors.push(`${formatAbiParameterLabel(input, index)}: ${coerced.message}`);
      return;
    }
    args.push(coerced);
  });

  return { args, errors };
}

function validateProposalForm({
  actionPreview,
  argsResult,
  contractOptions,
  form,
  selectedContract,
  selectedFunction,
  valueResult,
}: {
  readonly actionPreview: ReturnType<typeof buildActionDataPreview> | string | undefined;
  readonly argsResult: BuildArgsResult;
  readonly contractOptions: readonly ContractOption[];
  readonly form: FormState;
  readonly selectedContract: ContractOption | undefined;
  readonly selectedFunction: ParsedContractFunction | undefined;
  readonly valueResult: bigint | Error;
}): readonly string[] {
  const errors: string[] = [];

  if (!form.title.trim()) {
    errors.push("Title is required.");
  }

  if (contractOptions.length === 0) {
    errors.push("A known contract ABI is required to build a proposal action.");
  }

  if (!selectedContract) {
    errors.push("Choose a known contract.");
  }

  if (!selectedFunction) {
    errors.push("Choose a contract function.");
  } else if (selectedFunction.kind === "readable") {
    errors.push("Readable functions can be run here, but are not proposal actions in v1.");
  } else if (!selectedFunction.supportedInputs) {
    errors.push(
      `Unsupported input type: ${selectedFunction.unsupportedInputTypes.join(", ")}.`,
    );
  }

  errors.push(...argsResult.errors);

  if (valueResult instanceof Error) {
    errors.push(valueResult.message);
  }

  if (typeof actionPreview === "string") {
    errors.push(actionPreview);
  } else if (actionPreview instanceof Error) {
    errors.push(actionPreview.message);
  }

  return errors;
}

function buildPayload({
  actionPreview,
  form,
  orgId,
  selectedContract,
  selectedFunction,
  valueResult,
}: {
  readonly actionPreview: ReturnType<typeof buildActionDataPreview> | string | undefined;
  readonly form: FormState;
  readonly orgId: string;
  readonly selectedContract: ContractOption | undefined;
  readonly selectedFunction: ParsedContractFunction | undefined;
  readonly valueResult: bigint | Error;
}): CreateProposalPayload | Error {
  const parsedOrgId = parseUint(orgId, "Organization ID");
  if (parsedOrgId instanceof Error) {
    return parsedOrgId;
  }

  if (!selectedContract || !selectedFunction) {
    return new Error("Choose a contract and function.");
  }

  if (
    !actionPreview ||
    typeof actionPreview === "string" ||
    actionPreview instanceof Error
  ) {
    return new Error("Action data cannot be encoded yet.");
  }

  if (valueResult instanceof Error) {
    return valueResult;
  }

  const proposalTypeCode = safeProposalTypeCode(form.proposalType);
  if (proposalTypeCode instanceof Error) {
    return proposalTypeCode;
  }

  const title = form.title.trim();
  if (!title) {
    return new Error("Title is required.");
  }

  return {
    actionData: actionPreview.actionData,
    actionSelector: actionPreview.actionSelector,
    contractName: selectedContract.name,
    dataHash: actionPreview.dataHash,
    functionSignature: selectedFunction.signature,
    metadataUri: form.descriptionUri.trim() || title,
    orgId: parsedOrgId,
    proposalTypeCode,
    targetAddress: selectedContract.address,
    value: selectedFunction.payable ? valueResult : 0n,
  };
}

function buildCreateProposalContractArgs(payload: CreateProposalPayload): readonly [
  bigint,
  number,
  Address,
  bigint,
  Hex,
  Bytes32Hash,
  string,
] {
  return [
    payload.orgId,
    payload.proposalTypeCode,
    payload.targetAddress,
    payload.value,
    payload.actionSelector,
    payload.dataHash,
    payload.metadataUri,
  ];
}

function addGasMargin(gas: bigint): bigint {
  return gas + gas / 5n + 10_000n;
}

function parameterKey(signature: string, index: number): string {
  return `${signature}:${index}`;
}

function defaultLiteralValue(
  input: ReturnType<typeof getAbiInputs>[number],
  orgId: string,
): string {
  const lowerName = input.name?.toLowerCase();
  if (lowerName === "orgid" && /^u?int/.test(input.type)) {
    return orgId;
  }

  if (input.type === "bool") {
    return "false";
  }

  if (/^u?int/.test(input.type)) {
    return "0";
  }

  return "";
}

function isParameterSupported(type: string): boolean {
  return !(coerceAbiLiteral(type, defaultValueForValidation(type)) instanceof Error);
}

function defaultValueForValidation(type: string): string {
  if (type === "address") {
    return "0x0000000000000000000000000000000000000001";
  }
  if (type === "bool") {
    return "false";
  }
  if (type === "bytes32") {
    return `0x${"0".repeat(64)}`;
  }
  if (type.startsWith("bytes")) {
    const match = /^bytes([1-9]|[12][0-9]|3[0-2])$/.exec(type);
    if (match) {
      return `0x${"0".repeat(Number(match[1]) * 2)}`;
    }
    return "0x";
  }
  if (/^u?int/.test(type)) {
    return "0";
  }
  return "";
}

function isIntegerAbiType(type: string): boolean {
  return /^u?int(?:\d+)?$/.test(type);
}

function isMonoAbiType(type: string): boolean {
  return type === "address" || type.startsWith("bytes") || isIntegerAbiType(type);
}

function splitReadResult(
  value: unknown,
  outputCount: number,
): readonly unknown[] {
  if (outputCount === 0) {
    return [];
  }

  if (outputCount === 1) {
    return [value];
  }

  return Array.isArray(value) ? value : [];
}

function formatReadResultSource(
  id: string,
  results: readonly ReadResultValue[],
): string {
  const result = results.find((item) => item.id === id);
  if (!result) {
    return "Choose a compatible read result.";
  }

  return `Uses output from ${result.functionLabel}.${result.outputName || result.outputIndex}`;
}

function isUsableReadResult(
  result: CapturedReadResult,
  functions: readonly ParsedContractFunction[],
): boolean {
  return functions.some((fn) =>
    getAbiInputs(fn.abiItem).some(
      (input) => getCompatibleReadResults(input.type, [result]).length > 0,
    ),
  );
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

function normalizeTransactionError(
  error: unknown,
  abis: readonly Abi[] = [],
): string {
  const message = getErrorMessage(error);
  const decoded = formatDecodedContractError(error, abis);
  if (/user rejected|rejected request|denied transaction/i.test(message)) {
    return "Wallet transaction was rejected.";
  }
  if (decoded) {
    return `Transaction reverted: ${decoded}`;
  }
  if (/gas limit .*exceeds transaction gas cap|exceeds transaction gas cap/i.test(message)) {
    return `RPC rejected the transaction before execution because the selected gas limit exceeds the node gas cap. App Core simulates and estimates gas before wallet submission; if this persists, check the configured RPC gas cap and wallet gas override. Raw RPC message: ${message}`;
  }
  return message;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}
