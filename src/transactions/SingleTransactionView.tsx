import { Link } from "react-router-dom";
import { IsoAlert, IsoHelpTerm, IsoTransactionHash } from "../ui-kit";
import {
  getTransactionStageCopy,
  normalizeSingleTransactionStage,
  SINGLE_TRANSACTION_STAGE_ORDER,
} from "./transactionCopy";
import type {
  TransactionFlowItem,
  TransactionFlowStage,
  TransactionModalState,
} from "./transactionFlowTypes";

export function SingleTransactionView({
  state,
}: {
  readonly state: TransactionModalState;
}): JSX.Element {
  const item = state.items[0];

  if (!item) {
    return (
      <div className="transaction-modal-stack">
        <IsoAlert
          status="info"
          title="No transaction"
          description="No transaction has been attached to this modal."
        />
      </div>
    );
  }

  return (
    <div className="transaction-modal-stack">
      <TransactionAuthorityNotice />
      <TransactionStageList item={item} />
    </div>
  );
}

function TransactionStageList({
  item,
}: {
  readonly item: TransactionFlowItem;
}): JSX.Element {
  const normalizedStage = normalizeSingleTransactionStage(item.stage);

  return (
    <ol className="transaction-modal-stage-list">
      {SINGLE_TRANSACTION_STAGE_ORDER.map((stage) => (
        <TransactionStageListItem
          active={normalizedStage === stage}
          complete={
            isSingleStageComplete(normalizedStage, stage) ||
            (normalizedStage === "completed" && stage === "completed")
          }
          item={item}
          key={stage}
          stage={stage}
        />
      ))}
      {normalizedStage === "failed" ? (
        <TransactionStageListItem active danger item={item} stage="failed" />
      ) : null}
    </ol>
  );
}

function TransactionStageListItem({
  active,
  complete,
  danger,
  item,
  stage,
}: {
  readonly active?: boolean;
  readonly complete?: boolean;
  readonly danger?: boolean;
  readonly item: TransactionFlowItem;
  readonly stage: TransactionFlowStage;
}): JSX.Element {
  const copy = getTransactionStageCopy(stage);
  const className = [
    "transaction-modal-stage",
    active ? "transaction-modal-stage-active" : "",
    complete ? "transaction-modal-stage-complete" : "",
    danger ? "transaction-modal-stage-danger" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={className}>
      <span className="transaction-modal-stage-marker" />
      <div>
        <strong>{copy.label}</strong>
        <span>{copy.detail}</span>
        <TransactionStageMeta
          item={item}
          stage={stage}
          visible={Boolean(active || complete || danger)}
        />
      </div>
    </li>
  );
}

function TransactionStageMeta({
  item,
  stage,
  visible,
}: {
  readonly item: TransactionFlowItem;
  readonly stage: TransactionFlowStage;
  readonly visible: boolean;
}): JSX.Element | null {
  if (!visible) {
    return null;
  }

  const showDiagnostics = stage === "failed";
  const showHash =
    stage === "submitted" || stage === "failed";
  const showError = stage === "failed" && item.error;

  if (!showHash && !showDiagnostics && !showError) {
    return null;
  }

  return (
    <div className="transaction-modal-stage-meta">
      {showHash ? (
        <IsoTransactionHash
          blockExplorerUrl={item.blockExplorerUrl}
          txHash={item.txHash}
        />
      ) : null}
      {showDiagnostics ? (
        <Link className="diagnostics-text-link" to="/diagnostics">
          View diagnostics
        </Link>
      ) : null}
      {showError ? (
        <details className="transaction-modal-error">
          <summary>Raw error</summary>
          <code>{item.error}</code>
        </details>
      ) : null}
    </div>
  );
}

function TransactionAuthorityNotice(): JSX.Element {
  return (
    <IsoAlert
      status="info"
      title="Contracts remain authoritative"
      description={
        <span>
          This application shows wallet, chain, and{" "}
          <IsoHelpTerm term="controlPlane">Control Plane</IsoHelpTerm> progress.
          On-chain contracts remain the source of governance authority, and read
          models may lag briefly.
        </span>
      }
    />
  );
}

function isSingleStageComplete(
  current: TransactionFlowStage,
  stage: TransactionFlowStage,
): boolean {
  if (current === "failed" || current === "idle") {
    return false;
  }

  const currentIndex = SINGLE_TRANSACTION_STAGE_ORDER.indexOf(current);
  const stageIndex = SINGLE_TRANSACTION_STAGE_ORDER.indexOf(stage);

  return currentIndex > stageIndex;
}
