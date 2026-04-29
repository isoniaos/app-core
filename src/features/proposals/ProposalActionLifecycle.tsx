import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import {
  actionLabel,
  type ProposalActionStage,
  type ProposalActionTransaction,
} from "./useProposalAction";

interface ProposalActionLifecycleProps {
  readonly reset: () => void;
  readonly transaction: ProposalActionTransaction;
}

export function ProposalActionLifecycle({
  reset,
  transaction,
}: ProposalActionLifecycleProps): JSX.Element {
  const steps = [
    {
      id: "wallet_pending",
      title: "Wallet pending",
      detail: "Confirm or reject the transaction in the connected wallet.",
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
      detail: "Waiting for the on-chain receipt.",
    },
    {
      id: "confirmed_waiting_indexer",
      title: "Confirmed, waiting for indexer",
      detail:
        "The transaction is confirmed. The UI is polling Control Plane until the indexed route reflects it.",
    },
    {
      id: "indexed",
      title: "Indexed",
      detail: "Control Plane has reflected the proposal action.",
    },
  ] satisfies readonly {
    readonly id: Exclude<ProposalActionStage, "idle" | "failed">;
    readonly title: string;
    readonly detail: string;
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
            detail={transaction.error ?? "The proposal action failed."}
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
