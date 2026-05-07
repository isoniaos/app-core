import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { TransactionModal } from "./TransactionModal";
import type {
  OpenSerialTransactionModalInput,
  OpenSingleTransactionModalInput,
  TransactionFlowItemPatch,
  TransactionFlowItemUpdater,
  TransactionModalState,
} from "./transactionFlowTypes";

const INITIAL_TRANSACTION_MODAL_STATE: TransactionModalState = {
  items: [],
  mode: "single",
  open: false,
  title: "Transaction",
};

export interface TransactionModalContextValue {
  readonly close: () => void;
  readonly openSerial: (input: OpenSerialTransactionModalInput) => void;
  readonly openSingle: (input: OpenSingleTransactionModalInput) => void;
  readonly reset: () => void;
  readonly state: TransactionModalState;
  readonly updateItem: (
    itemId: string,
    update: TransactionFlowItemPatch | TransactionFlowItemUpdater,
  ) => void;
}

export const TransactionModalContext =
  createContext<TransactionModalContextValue | undefined>(undefined);

export function TransactionModalProvider({
  children,
}: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<TransactionModalState>(
    INITIAL_TRANSACTION_MODAL_STATE,
  );

  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_TRANSACTION_MODAL_STATE);
  }, []);

  const openSingle = useCallback((input: OpenSingleTransactionModalInput) => {
    setState({
      activeItemId: input.item.id,
      description: input.description,
      items: [input.item],
      mode: "single",
      open: true,
      title: input.title,
    });
  }, []);

  const openSerial = useCallback((input: OpenSerialTransactionModalInput) => {
    setState({
      activeItemId: input.activeItemId ?? input.items[0]?.id,
      description: input.description,
      items: input.items,
      mode: "serial",
      open: true,
      title: input.title,
    });
  }, []);

  const updateItem = useCallback(
    (
      itemId: string,
      update: TransactionFlowItemPatch | TransactionFlowItemUpdater,
    ) => {
      setState((current) => {
        const itemExists = current.items.some((item) => item.id === itemId);
        if (!itemExists) {
          return current;
        }

        return {
          ...current,
          activeItemId: current.activeItemId ?? itemId,
          items: current.items.map((item) =>
            item.id === itemId
              ? typeof update === "function"
                ? update(item)
                : { ...item, ...update }
              : item,
          ),
        };
      });
    },
    [],
  );

  const value = useMemo<TransactionModalContextValue>(
    () => ({
      close,
      openSerial,
      openSingle,
      reset,
      state,
      updateItem,
    }),
    [close, openSerial, openSingle, reset, state, updateItem],
  );

  return (
    <TransactionModalContext.Provider value={value}>
      {children}
      <TransactionModal onClose={close} onReset={reset} state={state} />
    </TransactionModalContext.Provider>
  );
}
