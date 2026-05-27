import { Link } from "react-router-dom";
import {
  IsoAlert,
  IsoBadge,
  IsoButton,
  IsoHelpTerm,
  IsoSteps,
  IsoTransactionHash,
  type IsoStepItem,
  type IsoStepStatus,
} from "../ui-kit";
import { formatEip5792LikelyReason } from "../wallet/eip5792";
import {
  getTransactionStageCopy,
  getTransactionStageTone,
  isControlPlaneWaitingStage,
  isFailedTransactionStage,
} from "./transactionCopy";
import type {
  BatchTransactionStatus,
  TransactionBatchDetails,
  TransactionFlowItem,
  TransactionModalState,
} from "./transactionFlowTypes";

export function BatchTransactionView({
  state,
}: {
  readonly state: TransactionModalState;
}): JSX.Element {
  const batch = state.batch;

  if (!batch) {
    return (
      <div className="transaction-modal-stack">
        <IsoAlert
          status="info"
          title="No batch"
          description="No batch transaction details have been attached to this modal."
        />
      </div>
    );
  }

  const kind = batch.kind ?? "wallet_eip5792";
  const showDiagnostics =
    batch.status === "waiting_for_control_plane" ||
    batch.status === "failed" ||
    state.items.some((item) => isControlPlaneWaitingStage(item.stage));

  return (
    <div className="transaction-modal-stack">
      <IsoAlert
        status="info"
        title={getBatchIntroTitle(kind)}
        description={<BatchIntroDescription kind={kind} />}
      />
      <div className="transaction-modal-batch-summary">
        <div>
          <strong>Batch status</strong>
          <span>{getBatchStatusCopy(batch.status, kind)}</span>
        </div>
        <IsoBadge className={`badge badge-${getBatchStatusTone(batch.status)}`}>
          {formatBatchStatus(batch.status)}
        </IsoBadge>
      </div>
      <div className="transaction-modal-batch-meta">
        <BatchMetaItem label="Capability" value={batch.capabilitySummary} />
        <BatchMetaItem
          label="Atomic capability"
          value={batch.atomicCapability ?? "Not reported"}
        />
        {kind === "wallet_eip5792" ? (
          <>
            <BatchMetaItem
              label="Wallet execution"
              value={formatWalletAtomicity(batch)}
            />
            <BatchMetaItem
              label="Wallet status"
              value={
                batch.walletStatusCode === undefined
                  ? "Not reported yet"
                  : String(batch.walletStatusCode)
              }
            />
          </>
        ) : (
          <BatchMetaItem label="Execution" value="Typed IsoCore batch function" />
        )}
      </div>
      {batch.batchId ? (
        <div className="transaction-modal-batch-id">
          <strong>Batch id</strong>
          <code>{batch.batchId}</code>
        </div>
      ) : null}
      {batch.statusDetail ? (
        <p className="transaction-modal-batch-note">{batch.statusDetail}</p>
      ) : null}
      {batch.walletAtomic === false ? (
        <IsoAlert
          status="warning"
          title="Wallet reported non-atomic execution"
          description="Some calls may complete while others fail. Isonia will use indexed read models to identify what remains before serial fallback continues."
        />
      ) : null}
      {batch.txHashes.length > 0 ? (
        <div className="transaction-modal-batch-hashes">
          <strong>Transactions</strong>
          {batch.txHashes.map((txHash) => (
            <IsoTransactionHash key={txHash} txHash={txHash} />
          ))}
        </div>
      ) : null}
      <IsoSteps
        ariaLabel="Batch transaction items"
        className="transaction-modal-steps"
        items={state.items.map(toBatchTransactionStep)}
      />
      <div className="transaction-modal-item-actions">
        {showDiagnostics ? (
          <Link className="diagnostics-text-link" to="/diagnostics">
            View diagnostics
          </Link>
        ) : null}
        {canShowSerialFallback(batch) ? (
          <IsoButton
            size="sm"
            variant="outline"
            onClick={() => void batch.fallbackSerial?.()}
          >
            {batch.fallbackSerialLabel ?? "Run step one by one"}
          </IsoButton>
        ) : null}
      </div>
      {batch.error ? (
        <details className="transaction-modal-error">
          <summary>Raw error</summary>
          <code>{batch.error}</code>
        </details>
      ) : null}
      {batch.lastMethodError ? (
        <details className="transaction-modal-error">
          <summary>Last EIP-5792 method error</summary>
          <dl className="transaction-modal-error-details">
            <BatchMetaItem label="Method" value={batch.lastMethodError.method} />
            <BatchMetaItem
              label="Provider"
              value={batch.lastMethodError.providerName ?? "Not reported"}
            />
            <BatchMetaItem
              label="Connector"
              value={batch.lastMethodError.connectorName ?? "Not reported"}
            />
            <BatchMetaItem
              label="Chain"
              value={
                batch.lastMethodError.chainId === undefined
                  ? "Not reported"
                  : String(batch.lastMethodError.chainId)
              }
            />
            <BatchMetaItem
              label="Code"
              value={batch.lastMethodError.code ?? "Not reported"}
            />
            <BatchMetaItem
              label="Likely reason"
              value={formatEip5792LikelyReason(
                batch.lastMethodError.likelyReason,
              )}
            />
          </dl>
          <code>{batch.lastMethodError.message}</code>
        </details>
      ) : null}
    </div>
  );
}

function BatchMetaItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function BatchIntroDescription({
  kind,
}: {
  readonly kind: NonNullable<TransactionBatchDetails["kind"]>;
}): JSX.Element {
  if (kind === "contract_batch") {
    return (
      <span>
        This path submits one typed IsoCore batch transaction for this activation
        step. Serial activation remains available, and indexed{" "}
        <IsoHelpTerm term="controlPlane">Control Plane</IsoHelpTerm> read models
        remain the source of setup progress.
      </span>
    );
  }

  return (
    <span>
      This path asks the connected wallet to process activation calls as a Wallet
      Call API batch. Serial activation remains available, and indexed{" "}
      <IsoHelpTerm term="controlPlane">Control Plane</IsoHelpTerm> read models
      remain the source of setup progress.
    </span>
  );
}

function getBatchIntroTitle(
  kind: NonNullable<TransactionBatchDetails["kind"]>,
): string {
  return kind === "contract_batch"
    ? "Typed contract batch activation"
    : "EIP-5792 wallet batch prototype";
}

function toBatchTransactionStep(item: TransactionFlowItem): IsoStepItem {
  const copy = getTransactionStageCopy(item.stage);

  return {
    description: (
      <>
        {item.description ? <span>{item.description}</span> : null}
        <span>{copy.detail}</span>
      </>
    ),
    id: item.id,
    meta: (
      <div className="transaction-modal-stage-meta">
        <IsoTransactionHash
          blockExplorerUrl={item.blockExplorerUrl}
          txHash={item.txHash}
        />
        {item.error ? (
          <details className="transaction-modal-error">
            <summary>Raw error</summary>
            <code>{item.error}</code>
          </details>
        ) : null}
      </div>
    ),
    status: getBatchItemStepStatus(item.stage),
    title: (
      <span className="transaction-modal-step-title">
        <span>{item.title}</span>
        <IsoBadge className={`badge badge-${getTransactionStageTone(item.stage)}`}>
          {copy.label}
        </IsoBadge>
      </span>
    ),
  };
}

function getBatchItemStepStatus(
  stage: TransactionFlowItem["stage"],
): IsoStepStatus {
  if (stage === "completed") {
    return "complete";
  }

  if (stage === "skipped") {
    return "skipped";
  }

  if (isFailedTransactionStage(stage)) {
    return "error";
  }

  if (
    stage === "waiting_for_wallet" ||
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "waiting_for_receipt" ||
    stage === "confirming" ||
    stage === "waiting_for_control_plane" ||
    stage === "confirmed_waiting_indexer"
  ) {
    return "loading";
  }

  return stage === "idle" ? "current" : "pending";
}

function canShowSerialFallback(batch: TransactionBatchDetails): boolean {
  if (batch.kind === "contract_batch") {
    return Boolean(batch.fallbackSerial) && batch.status !== "completed";
  }

  return (
    Boolean(batch.fallbackSerial) &&
    (batch.capabilityStatus !== "supported" ||
      (batch.status === "failed" && !batch.batchId))
  );
}

function formatWalletAtomicity(batch: TransactionBatchDetails): string {
  if (batch.walletAtomic === true) {
    return "Atomic";
  }
  if (batch.walletAtomic === false) {
    return "Non-atomic";
  }
  return "Not reported yet";
}

function formatBatchStatus(status: BatchTransactionStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "waiting_for_wallet":
      return "Waiting for wallet";
    case "submitted":
      return "Submitted";
    case "waiting_for_status":
      return "Waiting for wallet status";
    case "waiting_for_control_plane":
      return "Waiting for Control Plane";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}

function getBatchStatusCopy(
  status: BatchTransactionStatus,
  kind: NonNullable<TransactionBatchDetails["kind"]>,
): string {
  if (kind === "contract_batch") {
    switch (status) {
      case "ready":
        return "Ready to submit one typed IsoCore batch transaction.";
      case "waiting_for_wallet":
        return "Confirm the batch transaction in your wallet.";
      case "submitted":
        return "Batch transaction submitted.";
      case "waiting_for_status":
        return "Waiting for batch transaction status.";
      case "waiting_for_control_plane":
        return "Batch transaction confirmed. Waiting for indexed read models.";
      case "completed":
        return "All expected activation read models are indexed.";
      case "failed":
        return "Contract batch execution did not complete.";
    }
  }

  switch (status) {
    case "ready":
      return "Ready to ask the wallet to submit the batch.";
    case "waiting_for_wallet":
      return "Confirm the batch request in your wallet.";
    case "submitted":
      return "Wallet accepted the batch request.";
    case "waiting_for_status":
      return "Waiting for wallet_getCallsStatus.";
    case "waiting_for_control_plane":
      return "Wallet reports completion. Waiting for indexed read models.";
    case "completed":
      return "All expected activation read models are indexed.";
    case "failed":
      return "Batch execution did not complete.";
  }
}

function getBatchStatusTone(status: BatchTransactionStatus):
  | "danger"
  | "muted"
  | "success"
  | "warning" {
  switch (status) {
    case "ready":
      return "muted";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "waiting_for_wallet":
    case "submitted":
    case "waiting_for_status":
    case "waiting_for_control_plane":
      return "warning";
  }
}
