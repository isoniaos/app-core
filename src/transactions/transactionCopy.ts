import type {
  TransactionFlowItemStage,
  TransactionFlowStage,
} from "./transactionFlowTypes";

export type TransactionStageTone =
  | "danger"
  | "default"
  | "muted"
  | "success"
  | "warning";

export interface TransactionStageCopy {
  readonly detail: string;
  readonly label: string;
  readonly tone: TransactionStageTone;
}

export const SINGLE_TRANSACTION_STAGE_ORDER: readonly TransactionFlowStage[] = [
  "idle",
  "preparing",
  "wallet_pending",
  "submitted",
  "confirming",
  "confirmed_waiting_indexer",
  "completed",
];

const TRANSACTION_STAGE_COPY: Record<
  TransactionFlowItemStage,
  TransactionStageCopy
> = {
  idle: {
    detail: "Ready to prepare the transaction.",
    label: "Ready",
    tone: "muted",
  },
  preparing: {
    detail: "App Core is preparing the transaction request.",
    label: "Prepare",
    tone: "warning",
  },
  wallet_pending: {
    detail: "Confirm this transaction in your wallet.",
    label: "Waiting for wallet",
    tone: "warning",
  },
  submitted: {
    detail: "Transaction submitted.",
    label: "Transaction submitted",
    tone: "warning",
  },
  waiting_for_receipt: {
    detail: "App Core is waiting for the chain receipt.",
    label: "Waiting for receipt",
    tone: "warning",
  },
  confirming: {
    detail: "App Core is waiting for the chain receipt.",
    label: "Waiting for receipt",
    tone: "warning",
  },
  confirmed_waiting_indexer: {
    detail:
      "The transaction is mined. Isonia is waiting for Control Plane to index and project the result.",
    label: "Waiting for Control Plane",
    tone: "warning",
  },
  completed: {
    detail: "Completed.",
    label: "Completed",
    tone: "success",
  },
  failed: {
    detail: "Transaction failed.",
    label: "Transaction failed",
    tone: "danger",
  },
  pending: {
    detail: "This transaction is waiting for its turn.",
    label: "Pending",
    tone: "muted",
  },
  waiting_for_wallet: {
    detail: "Confirm this transaction in your wallet.",
    label: "Waiting for wallet",
    tone: "warning",
  },
  waiting_for_control_plane: {
    detail:
      "The transaction is mined. Isonia is waiting for Control Plane to index and project the result.",
    label: "Waiting for Control Plane",
    tone: "warning",
  },
  skipped: {
    detail: "This optional transaction was skipped.",
    label: "Skipped",
    tone: "muted",
  },
};

export function getTransactionStageCopy(
  stage: TransactionFlowItemStage,
): TransactionStageCopy {
  return TRANSACTION_STAGE_COPY[stage];
}

export function getTransactionStageTone(
  stage: TransactionFlowItemStage,
): TransactionStageTone {
  return getTransactionStageCopy(stage).tone;
}

export function isControlPlaneWaitingStage(
  stage: TransactionFlowItemStage,
): boolean {
  return (
    stage === "confirmed_waiting_indexer" ||
    stage === "waiting_for_control_plane"
  );
}

export function isCompletedTransactionStage(
  stage: TransactionFlowItemStage,
): boolean {
  return stage === "completed" || stage === "skipped";
}

export function isFailedTransactionStage(stage: TransactionFlowItemStage): boolean {
  return stage === "failed";
}

export function isActiveTransactionStage(
  stage: TransactionFlowItemStage,
): boolean {
  return (
    stage === "preparing" ||
    stage === "wallet_pending" ||
    stage === "waiting_for_wallet" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "waiting_for_receipt" ||
    stage === "confirmed_waiting_indexer" ||
    stage === "waiting_for_control_plane"
  );
}

export function normalizeSingleTransactionStage(
  stage: TransactionFlowItemStage,
): TransactionFlowStage {
  if (stage === "pending") {
    return "idle";
  }
  if (stage === "waiting_for_wallet") {
    return "wallet_pending";
  }
  if (stage === "waiting_for_control_plane") {
    return "confirmed_waiting_indexer";
  }
  if (stage === "waiting_for_receipt") {
    return "confirming";
  }
  if (stage === "skipped") {
    return "completed";
  }
  return stage;
}
