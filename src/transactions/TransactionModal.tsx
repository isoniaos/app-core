import { IsoButton, IsoDialog } from "../ui-kit";
import { SerialTransactionView } from "./SerialTransactionView";
import { SingleTransactionView } from "./SingleTransactionView";
import type { TransactionModalState } from "./transactionFlowTypes";

export interface TransactionModalProps {
  readonly onClose: () => void;
  readonly onReset: () => void;
  readonly state: TransactionModalState;
}

export function TransactionModal({
  onClose,
  onReset,
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
          <IsoButton onClick={onClose}>Close</IsoButton>
          {isTerminalModalState(state) ? (
            <IsoButton variant="outline" onClick={onReset}>
              Clear
            </IsoButton>
          ) : null}
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

function isTerminalModalState(state: TransactionModalState): boolean {
  return state.items.every(
    (item) =>
      item.stage === "completed" ||
      item.stage === "failed" ||
      item.stage === "skipped",
  );
}
