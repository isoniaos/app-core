import { Link } from "react-router-dom";
import {
  IsoAlert,
  IsoBadge,
  IsoButton,
  IsoHelpTerm,
  IsoSteps,
  IsoTransactionHash,
  type IsoStepItem,
  type IsoStepStatus,
} from "../ui-kit";
import {
  getTransactionStageCopy,
  getTransactionStageTone,
  isCompletedTransactionStage,
  isControlPlaneWaitingStage,
  isFailedTransactionStage,
} from "./transactionCopy";
import type {
  TransactionFlowItem,
  TransactionFlowItemStage,
  TransactionModalState,
} from "./transactionFlowTypes";

export function SerialTransactionView({
  state,
}: {
  readonly state: TransactionModalState;
}): JSX.Element {
  const activeItemId =
    state.activeItemId ??
    state.items.find(
      (item) => !isCompletedTransactionStage(getAllowedSerialStage(item)),
    )?.id;
  const activeItem = state.items.find((item) => item.id === activeItemId);
  const activeStage = activeItem
    ? getAllowedSerialStage(activeItem)
    : undefined;

  return (
    <div className="transaction-modal-stack">
      <IsoAlert
        status="info"
        title="Serial transaction flow"
        description={
          <span>
            Confirm transactions one by one. Completed on-chain actions remain
            completed if a later action fails. Isonia waits for{" "}
            <IsoHelpTerm term="controlPlane">Control Plane</IsoHelpTerm>{" "}
            projection after mined receipts.
          </span>
        }
      />
      <div className="transaction-modal-serial-summary">
        <strong>
          {countCompletedItems(state.items)} of {state.items.length} completed
        </strong>
        <span>Required items run in order; completed items stay completed.</span>
      </div>
      {activeItem && activeStage ? (
        <div className="transaction-modal-current">
          <div>
            <strong>Current transaction</strong>
            <span>{activeItem.title}</span>
          </div>
          <IsoBadge className={`badge badge-${getTransactionStageTone(activeStage)}`}>
            {getTransactionStageCopy(activeStage).label}
          </IsoBadge>
        </div>
      ) : null}
      <IsoSteps
        ariaLabel="Serial transaction steps"
        className="transaction-modal-steps"
        currentStepId={activeItemId}
        items={state.items.map((item) =>
          toSerialTransactionStep(item, item.id === activeItemId),
        )}
      />
    </div>
  );
}

function toSerialTransactionStep(
  item: TransactionFlowItem,
  active: boolean,
): IsoStepItem {
  const displayStage = getAllowedSerialStage(item);
  const copy = getTransactionStageCopy(displayStage);

  return {
    description: (
      <>
        {item.description ? <span>{item.description}</span> : null}
        <span>{copy.detail}</span>
      </>
    ),
    id: item.id,
    meta: <SerialTransactionStepMeta item={item} stage={displayStage} />,
    status: getSerialStepStatus(displayStage, active),
    title: (
      <span className="transaction-modal-step-title">
        <span>{item.title}</span>
        <IsoBadge className={`badge badge-${getTransactionStageTone(displayStage)}`}>
          {copy.label}
        </IsoBadge>
      </span>
    ),
  };
}

function SerialTransactionStepMeta({
  item,
  stage,
}: {
  readonly item: TransactionFlowItem;
  readonly stage: TransactionFlowItemStage;
}): JSX.Element {
  const showDiagnostics =
    isControlPlaneWaitingStage(stage) ||
    isFailedTransactionStage(stage);

  return (
    <div className="transaction-modal-stage-meta">
      <IsoTransactionHash
        blockExplorerUrl={item.blockExplorerUrl}
        txHash={item.txHash}
      />
      {showDiagnostics ? (
        <Link className="diagnostics-text-link" to="/diagnostics">
          View diagnostics
        </Link>
      ) : null}
      {isFailedTransactionStage(stage) && item.retry ? (
        <IsoButton
          className="iso-button-primary"
          size="sm"
          onClick={() => void item.retry?.()}
        >
          Retry
        </IsoButton>
      ) : null}
      {item.error ? (
        <details className="transaction-modal-error">
          <summary>Raw error</summary>
          <code>{item.error}</code>
        </details>
      ) : null}
    </div>
  );
}

function getSerialStepStatus(
  stage: TransactionFlowItemStage,
  active: boolean,
): IsoStepStatus {
  if (isCompletedTransactionStage(stage)) {
    return stage === "skipped" ? "skipped" : "complete";
  }

  if (isFailedTransactionStage(stage)) {
    return "error";
  }

  if (stage === "pending") {
    return active ? "current" : "pending";
  }

  return active ? "loading" : "pending";
}

function countCompletedItems(items: readonly TransactionFlowItem[]): number {
  return items.filter((item) =>
    isCompletedTransactionStage(getAllowedSerialStage(item)),
  ).length;
}

function getAllowedSerialStage(
  item: TransactionFlowItem,
): TransactionFlowItemStage {
  if (item.stage === "skipped" && item.allowSkip !== true) {
    return "failed";
  }

  return item.stage;
}
