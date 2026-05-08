import { IsoButton, IsoDialog } from "../ui-kit";
import { SerialTransactionView } from "./SerialTransactionView";
import { SingleTransactionView } from "./SingleTransactionView";
import type { TransactionModalState } from "./transactionFlowTypes";

export interface TransactionModalProps {
  readonly onClose: () => void;
  readonly state: TransactionModalState;
}

export function TransactionModal({
  onClose,
  state,
}: TransactionModalProps): JSX.Element {
  const body =
    state.mode === "serial" ? (
      <SerialTransactionView state={state} />
    ) : (
      <SingleTransactionView state={state} />
    );

  return (
    <IsoDialog
      body={body}
      closeLabel="Close transaction status"
      description={state.description}
      footer={
        <div className="transaction-modal-footer">
          <IsoButton variant="outline" onClick={onClose}>
            Close
          </IsoButton>
          <TransactionModalPrimaryAction state={state} onClose={onClose} />
        </div>
      }
      open={state.open}
      title={state.title}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    />
  );
}

function TransactionModalPrimaryAction({
  onClose,
  state,
}: {
  readonly onClose: () => void;
  readonly state: TransactionModalState;
}): JSX.Element {
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

function isCompletedModalState(state: TransactionModalState): boolean {
  return state.items.every(
    (item) =>
      item.stage === "completed" ||
      item.stage === "skipped",
  );
}
