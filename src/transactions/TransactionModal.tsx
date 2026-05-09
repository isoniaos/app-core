import { IsoButton, IsoDialog } from "../ui-kit";
import { BatchTransactionView } from "./BatchTransactionView";
import { SerialTransactionView } from "./SerialTransactionView";
import { SingleTransactionView } from "./SingleTransactionView";
import { isActiveTransactionStage } from "./transactionCopy";
import type {
  BatchTransactionStatus,
  TransactionModalState,
} from "./transactionFlowTypes";

export interface TransactionModalProps {
  readonly onClose: () => void;
  readonly state: TransactionModalState;
}

export function TransactionModal({
  onClose,
  state,
}: TransactionModalProps): JSX.Element {
  const closeDisabled = hasActiveTransaction(state);
  const close = (): void => {
    if (!closeDisabled) {
      onClose();
    }
  };
  const body = getTransactionModalBody(state);

  return (
    <IsoDialog
      body={body}
      closeDisabled={closeDisabled}
      closeLabel="Close transaction status"
      description={state.description}
      footer={
        <div className="transaction-modal-footer">
          {closeDisabled ? (
            <span className="transaction-modal-close-note">
              Close is available after the active transaction reaches completed
              or failed.
            </span>
          ) : null}
          <IsoButton disabled={closeDisabled} variant="outline" onClick={close}>
            Close
          </IsoButton>
          <TransactionModalPrimaryAction state={state} onClose={close} />
        </div>
      }
      open={state.open}
      title={state.title}
      onOpenChange={(open) => {
        if (!open && !closeDisabled) {
          onClose();
        }
      }}
    />
  );
}

function hasActiveTransaction(state: TransactionModalState): boolean {
  return (
    state.items.some((item) => isActiveTransactionStage(item.stage)) ||
    isActiveBatchStatus(state.batch?.status)
  );
}

function TransactionModalPrimaryAction({
  onClose,
  state,
}: {
  readonly onClose: () => void;
  readonly state: TransactionModalState;
}): JSX.Element {
  if (state.mode === "batch") {
    return (
      <TransactionModalBatchPrimaryAction state={state} onClose={onClose} />
    );
  }

  if (hasActiveTransaction(state)) {
    return <IsoButton disabled>In progress</IsoButton>;
  }

  const executableItem = state.items.find(
    (item) =>
      (item.stage === "idle" || item.stage === "pending") && item.execute,
  );
  const failedItem = state.items.find(
    (item) => item.stage === "failed" && item.retry,
  );

  if (failedItem?.retry) {
    return (
      <IsoButton onClick={() => void failedItem.retry?.()}>
        Retry
      </IsoButton>
    );
  }

  if (executableItem?.execute) {
    return (
      <IsoButton onClick={() => void executableItem.execute?.()}>
        {state.mode === "serial" ? "Start" : "Execute"}
      </IsoButton>
    );
  }

  if (isCompletedModalState(state)) {
    return <IsoButton onClick={onClose}>Done</IsoButton>;
  }

  if (state.items.some((item) => item.stage === "failed")) {
    return <IsoButton disabled>Failed</IsoButton>;
  }

  return <IsoButton disabled>In progress</IsoButton>;
}

function TransactionModalBatchPrimaryAction({
  onClose,
  state,
}: {
  readonly onClose: () => void;
  readonly state: TransactionModalState;
}): JSX.Element {
  const batch = state.batch;

  if (!batch) {
    return <IsoButton disabled>Unavailable</IsoButton>;
  }

  if (isActiveBatchStatus(batch.status)) {
    return <IsoButton disabled>In progress</IsoButton>;
  }

  if (batch.status === "ready" && batch.execute) {
    return (
      <IsoButton onClick={() => void batch.execute?.()}>
        Execute batch
      </IsoButton>
    );
  }

  if (batch.status === "failed" && batch.retry && !batch.batchId) {
    return <IsoButton onClick={() => void batch.retry?.()}>Retry batch</IsoButton>;
  }

  if (batch.status === "completed") {
    return <IsoButton onClick={onClose}>Done</IsoButton>;
  }

  if (batch.status === "failed") {
    return <IsoButton disabled>Failed</IsoButton>;
  }

  return <IsoButton disabled>In progress</IsoButton>;
}

function isCompletedModalState(state: TransactionModalState): boolean {
  return state.items.every(
    (item) =>
      item.stage === "completed" ||
      item.stage === "skipped",
  );
}

function getTransactionModalBody(state: TransactionModalState): JSX.Element {
  if (state.mode === "batch") {
    return <BatchTransactionView state={state} />;
  }
  if (state.mode === "serial") {
    return <SerialTransactionView state={state} />;
  }
  return <SingleTransactionView state={state} />;
}

function isActiveBatchStatus(
  status: BatchTransactionStatus | undefined,
): boolean {
  return (
    status === "waiting_for_wallet" ||
    status === "submitted" ||
    status === "waiting_for_status" ||
    status === "waiting_for_control_plane"
  );
}
