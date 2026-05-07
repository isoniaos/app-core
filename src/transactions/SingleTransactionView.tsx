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
  isControlPlaneWaitingStage,
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
      <div className="transaction-modal-current">
        <div>
          <strong>{item.title}</strong>
          {item.description ? <span>{item.description}</span> : null}
        </div>
        <IsoBadge className={`badge badge-${getTransactionStageTone(item.stage)}`}>
          {getTransactionStageCopy(item.stage).label}
        </IsoBadge>
      </div>
      <TransactionStageList item={item} />
      <TransactionDetail item={item} />
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
          complete={isSingleStageComplete(normalizedStage, stage)}
          key={stage}
          stage={stage}
        />
      ))}
      {normalizedStage === "failed" ? (
        <TransactionStageListItem active danger stage="failed" />
      ) : null}
    </ol>
  );
}

function TransactionStageListItem({
  active,
  complete,
  danger,
  stage,
}: {
  readonly active?: boolean;
  readonly complete?: boolean;
  readonly danger?: boolean;
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
      </div>
    </li>
  );
}

function TransactionDetail({
  item,
}: {
  readonly item: TransactionFlowItem;
}): JSX.Element {
  const copy = getTransactionStageCopy(item.stage);
  const showDiagnostics =
    isControlPlaneWaitingStage(item.stage) || item.stage === "failed";

  return (
    <section className="transaction-modal-detail">
      <div>
        <strong>{copy.label}</strong>
        <span>{copy.detail}</span>
      </div>
      <IsoTransactionHash
        blockExplorerUrl={item.blockExplorerUrl}
        txHash={item.txHash}
      />
      {showDiagnostics ? (
        <Link className="button button-small" to="/diagnostics">
          Open diagnostics
        </Link>
      ) : null}
      {item.stage === "failed" && item.retry ? (
        <IsoButton size="sm" onClick={() => void item.retry?.()}>
          Retry
        </IsoButton>
      ) : null}
      {item.error ? (
        <details className="transaction-modal-error">
          <summary>Raw error</summary>
          <code>{item.error}</code>
        </details>
      ) : null}
    </section>
  );
}

function TransactionAuthorityNotice(): JSX.Element {
  return (
    <IsoAlert
      status="info"
      title="Contracts remain authoritative"
      description={
        <span>
          App Core shows wallet, chain, and{" "}
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
