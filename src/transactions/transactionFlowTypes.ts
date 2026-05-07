export type TransactionFlowStage =
  | "idle"
  | "preparing"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "completed"
  | "failed";

export type SerialTransactionFlowStage =
  | "pending"
  | "waiting_for_wallet"
  | "submitted"
  | "confirming"
  | "waiting_for_control_plane"
  | "completed"
  | "failed"
  | "skipped";

export type TransactionFlowItemStage =
  | TransactionFlowStage
  | SerialTransactionFlowStage;

export interface TransactionFlowHash {
  readonly blockExplorerUrl?: string;
  readonly txHash?: `0x${string}`;
}

export interface TransactionFlowItem extends TransactionFlowHash {
  readonly allowSkip?: boolean;
  readonly description?: string;
  readonly error?: string;
  readonly id: string;
  readonly retry?: () => Promise<void> | void;
  readonly stage: TransactionFlowItemStage;
  readonly title: string;
}

export interface TransactionModalState {
  readonly activeItemId?: string;
  readonly description?: string;
  readonly items: readonly TransactionFlowItem[];
  readonly mode: "single" | "serial";
  readonly open: boolean;
  readonly title: string;
}

export interface OpenSingleTransactionModalInput {
  readonly description?: string;
  readonly item: TransactionFlowItem;
  readonly title: string;
}

export interface OpenSerialTransactionModalInput {
  readonly activeItemId?: string;
  readonly description?: string;
  readonly items: readonly TransactionFlowItem[];
  readonly title: string;
}

export type TransactionFlowItemPatch = Partial<
  Omit<TransactionFlowItem, "id">
>;

export type TransactionFlowItemUpdater = (
  item: TransactionFlowItem,
) => TransactionFlowItem;
