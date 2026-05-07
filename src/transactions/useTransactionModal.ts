import { useContext } from "react";
import {
  TransactionModalContext,
  type TransactionModalContextValue,
} from "./TransactionModalProvider";

export function useTransactionModal(): TransactionModalContextValue {
  const context = useContext(TransactionModalContext);

  if (!context) {
    throw new Error(
      "useTransactionModal must be used inside TransactionModalProvider.",
    );
  }

  return context;
}
