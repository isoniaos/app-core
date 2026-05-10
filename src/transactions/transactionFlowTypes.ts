import type { Eip5792MethodError } from "../wallet/eip5792";

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
  | "waiting_for_receipt"
  | "confirming"
  | "waiting_for_control_plane"
  | "completed"
  | "failed"
  | "skipped";

export type BatchTransactionStatus =
  | "ready"
  | "waiting_for_wallet"
  | "submitted"
  | "waiting_for_status"
  | "waiting_for_control_plane"
  | "completed"
  | "failed";

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
  readonly execute?: () => Promise<void> | void;
  readonly executeLabel?: string;
  readonly id: string;
  readonly retry?: () => Promise<void> | void;
  readonly retryLabel?: string;
  readonly stage: TransactionFlowItemStage;
  readonly title: string;
}

export interface TransactionBatchDetails {
  readonly atomicCapability?: string;
  readonly batchId?: string;
  readonly capabilityStatus: "supported" | "unsupported" | "unknown";
  readonly capabilitySummary: string;
  readonly error?: string;
  readonly execute?: () => Promise<void> | void;
  readonly fallbackSerial?: () => Promise<void> | void;
  readonly fallbackSerialLabel?: string;
  readonly lastMethodError?: Eip5792MethodError;
  readonly retry?: () => Promise<void> | void;
  readonly status: BatchTransactionStatus;
  readonly statusDetail?: string;
  readonly txHashes: readonly `0x${string}`[];
  readonly walletAtomic?: boolean;
  readonly walletStatusCode?: number;
}

export interface TransactionModalState {
  readonly activeItemId?: string;
  readonly batch?: TransactionBatchDetails;
  readonly description?: string;
  readonly items: readonly TransactionFlowItem[];
  readonly mode: "single" | "serial" | "batch";
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

export interface OpenBatchTransactionModalInput {
  readonly batch: TransactionBatchDetails;
  readonly description?: string;
  readonly items: readonly TransactionFlowItem[];
  readonly title: string;
}

export type TransactionFlowItemPatch = Partial<
  Omit<TransactionFlowItem, "id">
>;

export type TransactionBatchPatch =
  | Partial<TransactionBatchDetails>
  | ((batch: TransactionBatchDetails) => TransactionBatchDetails);

export type TransactionFlowItemUpdater = (
  item: TransactionFlowItem,
) => TransactionFlowItem;
