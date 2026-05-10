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
  return (
    <section className="proposal-action-lifecycle proposal-action-status-card">
      <div>
        <strong>Transaction status</strong>
        <span>{getActionStatusSummary(transaction)}</span>
        <ProposalActionStatusMeta
          blockExplorerUrl={blockExplorerUrl}
          transaction={transaction}
        />
      </div>
      <div className="chip-row">
        <StatusBadge tone={transactionTone(transaction.stage)}>
          {formatLabel(transaction.stage)}
        </StatusBadge>
        {transaction.stage === "failed" || transaction.stage === "indexed" ? (
          <button className="button button-small" type="button" onClick={reset}>
            Reset
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ProposalActionStatusMeta({
  blockExplorerUrl,
  transaction,
}: {
  readonly blockExplorerUrl?: string;
  readonly transaction: ProposalActionTransaction;
}): JSX.Element | null {
  if (transaction.stage === "idle") {
    return null;
  }

  const showDiagnostics =
    transaction.stage === "confirmed_waiting_indexer" ||
    transaction.stage === "failed";

  return (
    <div className="proposal-action-status-meta">
      <SetupTransactionHash
        blockExplorerUrl={blockExplorerUrl}
        txHash={transaction.txHash}
      />
      {showDiagnostics ? (
        <Link className="diagnostics-text-link" to="/diagnostics">
          View diagnostics
        </Link>
      ) : null}
    </div>
  );
}

function getActionStatusSummary(
  transaction: ProposalActionTransaction,
): string {
  if (!transaction.action) {
    return "No proposal action transaction is active.";
  }

  if (transaction.stage === "failed") {
    return transaction.error ?? `${actionLabel(transaction.action)} failed.`;
  }

  if (transaction.stage === "indexed") {
    return `${actionLabel(transaction.action)} is indexed; route state is refreshing.`;
  }

  return `${actionLabel(transaction.action)} - ${formatLabel(transaction.stage)}.`;
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
