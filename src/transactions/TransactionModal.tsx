import { IsoButton, IsoDialog, IsoIcon } from "../ui-kit";
import { BatchTransactionView } from "./BatchTransactionView";
import { SerialTransactionView } from "./SerialTransactionView";
import { SingleTransactionView } from "./SingleTransactionView";
import { isActiveTransactionStage } from "./transactionCopy";
import type {
  BatchTransactionStatus,
  TransactionFlowItem,
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
          <IsoButton
            className="iso-button-outline"
            disabled={closeDisabled}
            variant="outline"
            onClick={close}
          >
            Close
          </IsoButton>
          <div className="transaction-modal-footer-primary">
            <TransactionActionBlockAlert state={state} />
            <TransactionModalPrimaryAction state={state} onClose={close} />
          </div>
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
    return (
      <TransactionModalLoadingAction
        widthLabel={getTransactionLoadingActionLabel(state)}
      />
    );
  }

  const executableItem = state.items.find(
    (item) =>
      (item.stage === "idle" || item.stage === "pending") && item.execute,
  );
  const blockedItem = getTransactionActionBlockedItem(state);
  const failedItem = state.items.find(
    (item) => item.stage === "failed" && item.retry,
  );

  if (blockedItem?.actionBlock) {
    return (
      <IsoButton className="iso-button-primary" disabled>
        {blockedItem.executeLabel ??
          blockedItem.retryLabel ??
          (state.mode === "serial" ? "Start" : "Execute")}
      </IsoButton>
    );
  }

  if (failedItem?.retry) {
    return (
      <IsoButton
        className="iso-button-primary"
        onClick={() => void failedItem.retry?.()}
      >
        {failedItem.retryLabel ?? "Retry"}
      </IsoButton>
    );
  }

  if (executableItem?.execute) {
    return (
      <IsoButton
        className="iso-button-primary"
        onClick={() => void executableItem.execute?.()}
      >
        {executableItem.executeLabel ??
          (state.mode === "serial" ? "Start" : "Execute")}
      </IsoButton>
    );
  }

  if (isCompletedModalState(state)) {
    return (
      <IsoButton className="iso-button-primary" onClick={onClose}>
        Done
      </IsoButton>
    );
  }

  if (state.items.some((item) => item.stage === "failed")) {
    return <IsoButton disabled>Failed</IsoButton>;
  }

  return <IsoButton disabled>In progress</IsoButton>;
}

function TransactionActionBlockAlert({
  state,
}: {
  readonly state: TransactionModalState;
}): JSX.Element | null {
  const blockedItem = getTransactionActionBlockedItem(state);
  const block = blockedItem?.actionBlock;

  if (!block) {
    return null;
  }

  return (
    <div className="transaction-modal-action-block" role="alert">
      <IsoIcon name="settings-error" size={18} />
      <div>
        <strong>{block.title}</strong>
        <span>{block.message}</span>
      </div>
    </div>
  );
}

function getTransactionActionBlockedItem(
  state: TransactionModalState,
): TransactionFlowItem | undefined {
  return (
    state.items.find((item) => item.id === state.activeItemId && item.actionBlock) ??
    state.items.find((item) => item.actionBlock)
  );
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
    return <TransactionModalLoadingAction widthLabel="Execute batch" />;
  }

  if (batch.status === "ready" && batch.execute) {
    return (
      <IsoButton
        className="iso-button-primary"
        onClick={() => void batch.execute?.()}
      >
        Execute batch
      </IsoButton>
    );
  }

  if (batch.status === "failed" && batch.retry && !batch.batchId) {
    return (
      <IsoButton
        className="iso-button-primary"
        onClick={() => void batch.retry?.()}
      >
        Retry batch
      </IsoButton>
    );
  }

  if (batch.status === "completed") {
    return (
      <IsoButton className="iso-button-primary" onClick={onClose}>
        Done
      </IsoButton>
    );
  }

  if (batch.status === "failed") {
    return <IsoButton disabled>Failed</IsoButton>;
  }

  return <IsoButton disabled>In progress</IsoButton>;
}

function TransactionModalLoadingAction({
  widthLabel,
}: {
  readonly widthLabel: string;
}): JSX.Element {
  return (
    <IsoButton
      className="iso-button-primary transaction-modal-loading-action"
      disabled
      aria-label="Transaction in progress"
    >
      <span className="transaction-modal-loading-ghost">{widthLabel}</span>
      <span aria-hidden="true" className="transaction-modal-button-spinner" />
    </IsoButton>
  );
}

function getTransactionLoadingActionLabel(
  state: TransactionModalState,
): string {
  const activeItem =
    state.items.find((item) => item.id === state.activeItemId) ??
    state.items.find((item) => isActiveTransactionStage(item.stage));

  return (
    activeItem?.executeLabel ??
    activeItem?.retryLabel ??
    state.items.find((item) => item.execute)?.executeLabel ??
    state.items.find((item) => item.retry)?.retryLabel ??
    (state.mode === "serial" ? "Start" : "Execute")
  );
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
