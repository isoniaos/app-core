import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  SetupActionLifecycleStage,
  SetupActionTransaction,
} from "./setup-action-execution-types";

const SETUP_LIFECYCLE_STAGE_LABELS: Record<
  SetupActionLifecycleStage,
  string
> = {
  idle: "Ready",
  wallet_pending: "Waiting for wallet",
  submitted: "Transaction submitted",
  confirming: "Waiting for receipt",
  confirmed_waiting_indexer: "Mined, waiting for Control Plane",
  indexed: "Indexed and projected",
  failed: "Failed",
};

export function getSetupLifecycleStageDisplayLabel(
  stage: SetupActionLifecycleStage,
): string {
  return SETUP_LIFECYCLE_STAGE_LABELS[stage];
}

export function getSetupActionStageLabel(
  stage: SetupActionLifecycleStage,
): string {
  if (stage === "confirmed_waiting_indexer") {
    return "Waiting for Control Plane";
  }

  return getSetupLifecycleStageDisplayLabel(stage);
}

export function SetupTransactionStatus({
  blockExplorerUrl,
  emittedIdLabel,
  entityName,
  idleDetail,
  indexedDetail,
  reset,
  transaction,
}: {
  readonly blockExplorerUrl?: string;
  readonly emittedIdLabel?: string;
  readonly entityName: string;
  readonly idleDetail: string;
  readonly indexedDetail: string;
  readonly reset?: () => void;
  readonly transaction: SetupActionTransaction;
}): JSX.Element {
  const steps = [
    {
      id: "wallet_pending",
      title: getSetupLifecycleStageDisplayLabel("wallet_pending"),
      detail: `Confirm or reject the ${entityName} transaction in the connected wallet.`,
    },
    {
      id: "submitted",
      title: getSetupLifecycleStageDisplayLabel("submitted"),
      detail: (
        <SetupSubmittedDetail
          blockExplorerUrl={blockExplorerUrl}
          txHash={transaction.txHash}
        />
      ),
    },
    {
      id: "confirming",
      title: getSetupLifecycleStageDisplayLabel("confirming"),
      detail: "App Core submitted the transaction and is waiting for the chain receipt.",
    },
    {
      id: "confirmed_waiting_indexer",
      title: getSetupLifecycleStageDisplayLabel("confirmed_waiting_indexer"),
      detail: (
        <SetupControlPlaneWaitingDetail
          blockExplorerUrl={blockExplorerUrl}
          emittedIdLabel={emittedIdLabel}
          txHash={transaction.txHash}
        />
      ),
    },
    {
      id: "indexed",
      title: getSetupLifecycleStageDisplayLabel("indexed"),
      detail: indexedDetail,
    },
  ] satisfies readonly {
    readonly detail: ReactNode;
    readonly id: Exclude<SetupActionLifecycleStage, "idle" | "failed">;
    readonly title: string;
  }[];

  return (
    <section className="setup-action-lifecycle">
      <div className="transaction-steps">
        {transaction.stage === "idle" ? (
          <SetupLifecycleStep
            active
            detail={idleDetail}
            title={getSetupLifecycleStageDisplayLabel("idle")}
          />
        ) : null}
        {steps.map((step) => (
          <SetupLifecycleStep
            active={isTransactionStepActive(transaction.stage, step.id)}
            complete={isTransactionStepComplete(transaction.stage, step.id)}
            detail={step.detail}
            key={step.id}
            title={step.title}
          />
        ))}
        {transaction.stage === "failed" ? (
          <SetupLifecycleStep
            active
            danger
            detail={
              <SetupFailedTransactionDetail
                blockExplorerUrl={blockExplorerUrl}
                transaction={transaction}
              />
            }
            title={getSetupLifecycleStageDisplayLabel("failed")}
          />
        ) : null}
      </div>
      {reset &&
      (transaction.stage === "failed" || transaction.stage === "indexed") ? (
        <div className="setup-execution-footer">
          <button className="button button-small" type="button" onClick={reset}>
            Reset local execution state
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function SetupLifecycleStep({
  active,
  complete,
  danger,
  detail,
  title,
}: {
  readonly active?: boolean;
  readonly complete?: boolean;
  readonly danger?: boolean;
  readonly detail: ReactNode;
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
      <div className="transaction-step-detail">{detail}</div>
    </div>
  );
}

export function SetupTransactionHash({
  blockExplorerUrl,
  txHash,
}: {
  readonly blockExplorerUrl?: string;
  readonly txHash?: `0x${string}`;
}): JSX.Element | null {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return null;
  }

  const txUrl = buildBlockExplorerTransactionUrl(blockExplorerUrl, txHash);
  const displayHash = shortenTransactionHash(txHash);

  async function copyToClipboard(): Promise<void> {
    if (!txHash || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span className="setup-transaction-hash">
      <span className="setup-transaction-hash-label">Tx</span>
      {txUrl ? (
        <a
          className="setup-transaction-hash-value"
          href={txUrl}
          rel="noreferrer"
          target="_blank"
          title={txHash}
        >
          {displayHash}
        </a>
      ) : (
        <code className="setup-transaction-hash-value" title={txHash}>
          {displayHash}
        </code>
      )}
      <button
        className="address-copy-button"
        type="button"
        onClick={() => {
          void copyToClipboard();
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

function SetupSubmittedDetail({
  blockExplorerUrl,
  txHash,
}: {
  readonly blockExplorerUrl?: string;
  readonly txHash?: `0x${string}`;
}): JSX.Element {
  return (
    <div className="setup-transaction-status-detail">
      <span>
        App Core has the transaction hash. The transaction may still be waiting
        to be mined.
      </span>
      <SetupTransactionHash
        blockExplorerUrl={blockExplorerUrl}
        txHash={txHash}
      />
    </div>
  );
}

function SetupControlPlaneWaitingDetail({
  blockExplorerUrl,
  emittedIdLabel,
  txHash,
}: {
  readonly blockExplorerUrl?: string;
  readonly emittedIdLabel?: string;
  readonly txHash?: `0x${string}`;
}): JSX.Element {
  return (
    <div className="setup-transaction-status-detail">
      <span>
        The transaction is mined and the receipt is confirmed. App Core is
        waiting for Control Plane indexing, projection, and read model updates.
      </span>
      {emittedIdLabel ? <span>{emittedIdLabel} was emitted on-chain.</span> : null}
      <SetupTransactionHash
        blockExplorerUrl={blockExplorerUrl}
        txHash={txHash}
      />
      <span>
        Local Hardhat restarts or stale runtime config can delay this step.
      </span>
      <Link className="button button-small" to="/diagnostics">
        Open diagnostics
      </Link>
    </div>
  );
}

function SetupFailedTransactionDetail({
  blockExplorerUrl,
  transaction,
}: {
  readonly blockExplorerUrl?: string;
  readonly transaction: SetupActionTransaction;
}): JSX.Element {
  const errorMessage = normalizeSetupErrorMessage(transaction.error);
  const guidance = getFailureGuidance(errorMessage);

  return (
    <div className="setup-transaction-status-detail">
      <span>
        <strong>{guidance.label}.</strong> {guidance.summary}
      </span>
      <span>{guidance.recoveryHint}</span>
      <SetupTransactionHash
        blockExplorerUrl={blockExplorerUrl}
        txHash={transaction.txHash}
      />
      <div className="setup-transaction-raw-error">
        <span>Raw error</span>
        <code>{errorMessage}</code>
      </div>
      <Link className="button button-small" to="/diagnostics">
        Open diagnostics
      </Link>
    </div>
  );
}

interface FailureGuidance {
  readonly label: string;
  readonly recoveryHint: string;
  readonly summary: string;
}

function getFailureGuidance(errorMessage: string): FailureGuidance {
  if (/wallet transaction was rejected|user rejected|rejected request|denied/i.test(errorMessage)) {
    return {
      label: "Wallet rejection",
      recoveryHint: "Retry when you are ready to sign the transaction.",
      summary: "The connected wallet rejected the signature request.",
    };
  }

  if (/transaction reverted|execution reverted|contract function execution|reverted/i.test(errorMessage)) {
    return {
      label: "Transaction revert",
      recoveryHint:
        "Check the signer, authority, route dependencies, and draft validation before retrying.",
      summary: "The chain rejected execution after submission or simulation.",
    };
  }

  if (/indexer timeout|timeout|timed out|control plane|read model|projection|indexed/i.test(errorMessage)) {
    return {
      label: "Timeout or indexer delay",
      recoveryHint:
        "Check diagnostics, then retry or reload after Control Plane catches up.",
      summary:
        "The transaction may be mined, but App Core did not see the expected read model update in time.",
    };
  }

  return {
    label: "Unknown error",
    recoveryHint: "Inspect the console and diagnostics for the next debugging step.",
    summary: "App Core could not classify this setup execution failure.",
  };
}

function normalizeSetupErrorMessage(error: string | undefined): string {
  const trimmed = error?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Unknown transaction error.";
}

function buildBlockExplorerTransactionUrl(
  blockExplorerUrl: string | undefined,
  txHash: `0x${string}`,
): string | undefined {
  const trimmedUrl = blockExplorerUrl?.trim();
  if (!trimmedUrl) {
    return undefined;
  }

  try {
    new URL(trimmedUrl);
  } catch {
    return undefined;
  }

  return `${trimmedUrl.replace(/\/+$/u, "")}/tx/${txHash}`;
}

function shortenTransactionHash(txHash: `0x${string}`): string {
  if (txHash.length <= 20) {
    return txHash;
  }

  return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
}

function isTransactionStepActive(
  current: SetupActionLifecycleStage,
  step: Exclude<SetupActionLifecycleStage, "idle" | "failed">,
): boolean {
  return current === step;
}

function isTransactionStepComplete(
  current: SetupActionLifecycleStage,
  step: Exclude<SetupActionLifecycleStage, "idle" | "failed">,
): boolean {
  const order: Record<
    Exclude<SetupActionLifecycleStage, "idle" | "failed">,
    number
  > = {
    wallet_pending: 1,
    submitted: 2,
    confirming: 3,
    confirmed_waiting_indexer: 4,
    indexed: 5,
  };

  return (
    current !== "failed" && current !== "idle" && order[current] > order[step]
  );
}
