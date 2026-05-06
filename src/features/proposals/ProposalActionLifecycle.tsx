import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SetupTransactionHash } from "../setup/SetupTransactionStatus";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import {
  actionLabel,
  type ProposalActionStage,
  type ProposalActionTransaction,
} from "./useProposalAction";

interface ProposalActionLifecycleProps {
  readonly blockExplorerUrl?: string;
  readonly reset: () => void;
  readonly transaction: ProposalActionTransaction;
}

export function ProposalActionLifecycle({
  blockExplorerUrl,
  reset,
  transaction,
}: ProposalActionLifecycleProps): JSX.Element {
  const steps = [
    {
      id: "wallet_pending",
      title: "Waiting for wallet",
      detail: "Confirm or reject the transaction in the connected wallet.",
    },
    {
      id: "submitted",
      title: "Transaction submitted",
      detail: (
        <ProposalSubmittedDetail
          blockExplorerUrl={blockExplorerUrl}
          txHash={transaction.txHash}
        />
      ),
    },
    {
      id: "confirming",
      title: "Waiting for receipt",
      detail: "App Core submitted the transaction and is waiting for the chain receipt.",
    },
    {
      id: "confirmed_waiting_indexer",
      title: "Mined, waiting for Control Plane",
      detail: (
        <ProposalControlPlaneWaitingDetail
          blockExplorerUrl={blockExplorerUrl}
          txHash={transaction.txHash}
        />
      ),
    },
    {
      id: "indexed",
      title: "Indexed and projected",
      detail: "Control Plane has reflected the proposal action in read models and route state.",
    },
  ] satisfies readonly {
    readonly id: Exclude<ProposalActionStage, "idle" | "failed">;
    readonly detail: ReactNode;
    readonly title: string;
  }[];

  return (
    <section className="proposal-action-lifecycle">
      <div className="panel-header proposal-action-lifecycle-header">
        <div>
          <h3>Transaction</h3>
          <p className="panel-subtitle">
            {transaction.action
              ? `${actionLabel(transaction.action)} - ${formatLabel(
                  transaction.stage,
                )}`
              : "No proposal action submitted yet."}
          </p>
        </div>
        <div className="chip-row">
          <StatusBadge tone={transactionTone(transaction.stage)}>
            {formatLabel(transaction.stage)}
          </StatusBadge>
          {transaction.stage === "failed" || transaction.stage === "indexed" ? (
            <button
              className="button button-small"
              type="button"
              onClick={reset}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
      <div className="transaction-steps">
        {transaction.stage === "idle" ? (
          <TransactionStep
            active
            detail="Ready for a proposal action."
            title="Ready"
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
            detail={
              <ProposalFailedDetail
                blockExplorerUrl={blockExplorerUrl}
                transaction={transaction}
              />
            }
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

function ProposalSubmittedDetail({
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

function ProposalControlPlaneWaitingDetail({
  blockExplorerUrl,
  txHash,
}: {
  readonly blockExplorerUrl?: string;
  readonly txHash?: `0x${string}`;
}): JSX.Element {
  return (
    <div className="setup-transaction-status-detail">
      <span>
        The transaction is mined and the receipt is confirmed. App Core is
        waiting for Control Plane indexing, projection, and route read model
        updates.
      </span>
      <SetupTransactionHash
        blockExplorerUrl={blockExplorerUrl}
        txHash={txHash}
      />
      <span>
        Local Hardhat restarts, a stopped indexer, or stale runtime config can
        delay this step.
      </span>
      <Link className="button button-small" to="/diagnostics">
        Open diagnostics
      </Link>
    </div>
  );
}

function ProposalFailedDetail({
  blockExplorerUrl,
  transaction,
}: {
  readonly blockExplorerUrl?: string;
  readonly transaction: ProposalActionTransaction;
}): JSX.Element {
  const errorMessage = normalizeProposalErrorMessage(transaction.error);
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
      recoveryHint: "Retry when you are ready to sign the proposal action.",
      summary: "The connected wallet rejected the signature request.",
    };
  }

  if (/transaction reverted|execution reverted|contract function execution|reverted/i.test(errorMessage)) {
    return {
      label: "Transaction revert",
      recoveryHint:
        "Check the signer, authority, route state, and DemoTarget action hash before retrying.",
      summary: "The chain rejected execution after submission or simulation.",
    };
  }

  if (/indexer timeout|timeout|timed out|control plane|read model|projection|indexed/i.test(errorMessage)) {
    return {
      label: "Timeout or indexer delay",
      recoveryHint:
        "Open diagnostics, confirm Control Plane/indexer health, then reload after projections catch up.",
      summary:
        "The transaction may be mined, but App Core did not see the expected proposal read model update in time.",
    };
  }

  return {
    label: "Unknown error",
    recoveryHint:
      "Inspect diagnostics, wallet chain, runtime config, and browser console for the next debugging step.",
    summary: "App Core could not classify this proposal action failure.",
  };
}

function normalizeProposalErrorMessage(error: string | undefined): string {
  const trimmed = error?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Unknown transaction error.";
}

function transactionTone(
  stage: ProposalActionStage,
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
  current: ProposalActionStage,
  step: Exclude<ProposalActionStage, "idle" | "failed">,
): boolean {
  return current === step;
}

function isTransactionStepComplete(
  current: ProposalActionStage,
  step: Exclude<ProposalActionStage, "idle" | "failed">,
): boolean {
  const order: Record<Exclude<ProposalActionStage, "idle" | "failed">, number> =
    {
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
