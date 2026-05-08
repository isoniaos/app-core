import { Link } from "react-router-dom";
import {
  IsoAlert,
  IsoBadge,
  IsoButton,
  IsoHelpTerm,
  IsoTransactionHash,
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
        <span>Skipped items are shown only when an item explicitly allows it.</span>
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
      <div className="transaction-modal-item-list">
        {state.items.map((item, index) => (
          <SerialTransactionItem
            active={item.id === activeItemId}
            index={index + 1}
            item={item}
            key={item.id}
          />
        ))}
      </div>
    </div>
  );
}

function SerialTransactionItem({
  active,
  index,
  item,
}: {
  readonly active: boolean;
  readonly index: number;
  readonly item: TransactionFlowItem;
}): JSX.Element {
  const displayStage = getAllowedSerialStage(item);
  const copy = getTransactionStageCopy(displayStage);
  const showDiagnostics =
    isControlPlaneWaitingStage(displayStage) ||
    isFailedTransactionStage(displayStage);

  return (
    <article
      className={[
        "transaction-modal-item",
        active ? "transaction-modal-item-active" : "",
        isCompletedTransactionStage(displayStage)
          ? "transaction-modal-item-complete"
          : "",
        isFailedTransactionStage(displayStage)
          ? "transaction-modal-item-danger"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="transaction-modal-item-index">{index}</div>
      <div className="transaction-modal-item-main">
        <div className="transaction-modal-item-header">
          <div>
            <strong>{item.title}</strong>
            {item.description ? <span>{item.description}</span> : null}
          </div>
          <IsoBadge className={`badge badge-${getTransactionStageTone(displayStage)}`}>
            {copy.label}
          </IsoBadge>
        </div>
        <p>{copy.detail}</p>
        <IsoTransactionHash
          blockExplorerUrl={item.blockExplorerUrl}
          txHash={item.txHash}
        />
        <div className="transaction-modal-item-actions">
          {showDiagnostics ? (
            <Link className="button button-small" to="/diagnostics">
              Open diagnostics
            </Link>
          ) : null}
          {isFailedTransactionStage(displayStage) && item.retry ? (
            <IsoButton size="sm" onClick={() => void item.retry?.()}>
              Retry
            </IsoButton>
          ) : null}
        </div>
        {item.error ? (
          <details className="transaction-modal-error">
            <summary>Raw error</summary>
            <code>{item.error}</code>
          </details>
        ) : null}
      </div>
    </article>
  );
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
