import { Link } from "react-router-dom";
import {
  IsoAlert,
  IsoHelpTerm,
  IsoSteps,
  IsoTransactionHash,
  type IsoStepItem,
  type IsoStepStatus,
} from "../ui-kit";
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
  const items: IsoStepItem[] = SINGLE_TRANSACTION_STAGE_ORDER.map((stage) => {
    const copy = getTransactionStageCopy(stage);
    const status = getSingleStageStatus(normalizedStage, stage);

    return {
      description: copy.detail,
      id: stage,
      meta: (
        <TransactionStageMeta
          item={item}
          stage={stage}
          visible={status === "complete" || status === "current" || status === "loading"}
        />
      ),
      status,
      title: copy.label,
    };
  });

  if (normalizedStage === "failed") {
    const copy = getTransactionStageCopy("failed");
    items.push({
      description: copy.detail,
      id: "failed",
      meta: <TransactionStageMeta item={item} stage="failed" visible />,
      status: "error",
      title: copy.label,
    });
  }

  return (
    <IsoSteps
      ariaLabel="Transaction progress"
      className="transaction-modal-steps"
      currentStepId={normalizedStage}
      items={items}
    />
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

  const showDiagnostics =
    stage === "failed" || stage === "confirmed_waiting_indexer";
  const showHash =
    stage === "submitted" ||
    stage === "confirmed_waiting_indexer" ||
    stage === "failed";
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

function getSingleStageStatus(
  current: TransactionFlowStage,
  stage: TransactionFlowStage,
): IsoStepStatus {
  if (current === "failed") {
    return "pending";
  }

  if (current === "completed" && stage === "completed") {
    return "complete";
  }

  if (isSingleStageComplete(current, stage)) {
    return "complete";
  }

  if (current === stage) {
    return current === "idle" ? "current" : "loading";
  }

  return "pending";
}
