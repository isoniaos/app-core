import type { SetupAction, SetupDraft } from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { Link } from "react-router-dom";
import { useRuntimeConfig } from "../../config/runtime-config";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  getSetupActionStageLabel,
  SetupTransactionHash,
} from "./SetupTransactionStatus";
import type {
  SetupActionLifecycleStage,
  SetupActionReadiness,
  SetupActionTransaction,
  SetupDraftExecutionState,
} from "./useSetupActionExecution";

interface SetupExecutionPanelProps {
  readonly busy: boolean;
  readonly draft: SetupDraft;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly readiness: SetupActionReadiness | undefined;
  readonly reset: () => void;
  readonly state: SetupDraftExecutionState;
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

interface PanelStatus {
  readonly label: string;
  readonly tone: BadgeTone;
}

export function SetupExecutionPanel({
  busy,
  draft,
  executeCreateOrganization,
  readiness,
  reset,
  state,
}: SetupExecutionPanelProps): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const createOrganizationAction = draft.actions.find(
    (action) => action.kind === SetupActionKind.CreateOrganization,
  );
  const draftBlocked = draft.warnings.some(
    (warning) => warning.severity === "error",
  );
  const submitDisabled =
    busy ||
    state.createOrganization.stage === "indexed" ||
    draftBlocked;
  const panelStatus = getCreateOrganizationPanelStatus({ busy, state });

  return (
    <section className="setup-execution-panel">
      <div className="panel-header">
        <div>
          <h2>Execution</h2>
          <p className="panel-subtitle">
            Submit the organization root. Detailed transaction progress appears
            in the modal.
          </p>
        </div>
        <StatusBadge tone={panelStatus.tone}>{panelStatus.label}</StatusBadge>
      </div>

      {draftBlocked ? <SetupDraftBlockedNotice /> : null}
      {!draftBlocked && readiness ? (
        <SetupReadinessNotice readiness={readiness} />
      ) : null}

      {createOrganizationAction ? (
        <CreateOrganizationActionCard
          action={createOrganizationAction}
          busy={busy}
          disabled={submitDisabled}
          executeCreateOrganization={executeCreateOrganization}
          resolvedOrgId={state.resolvedOrgId}
          transaction={state.createOrganization}
        />
      ) : (
        <div className="inline-state inline-state-muted setup-execution-inline">
          <strong>No create organization action</strong>
          <span>This draft is already attached to an indexed organization.</span>
        </div>
      )}

      <CreateOrganizationInlineStatus
        blockExplorerUrl={runtimeConfig.blockExplorerUrl}
        reset={reset}
        resolvedOrgId={state.resolvedOrgId}
        transaction={state.createOrganization}
      />
    </section>
  );
}

function CreateOrganizationActionCard({
  action,
  busy,
  disabled,
  executeCreateOrganization,
  resolvedOrgId,
  transaction,
}: {
  readonly action: SetupAction;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly resolvedOrgId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): JSX.Element {
  const organizationName =
    action.kind === SetupActionKind.CreateOrganization
      ? action.fallbackName
      : "organization";

  return (
    <div className="setup-execution-action">
      <div className="setup-execution-action-main">
        <div>
          <strong>Create {organizationName} organization</strong>
          <span>
            {action.kind === SetupActionKind.CreateOrganization
              ? "Create the organization root before activation."
              : "Unsupported setup action"}
          </span>
        </div>
      </div>
      <div className="action-row">
        <button
          className="button button-primary"
          disabled={disabled}
          type="button"
          onClick={() => {
            void executeCreateOrganization();
          }}
        >
          {getCreateOrganizationButtonLabel({
            busy,
            disabled,
            resolvedOrgId,
            transaction,
          })}
        </button>
      </div>
    </div>
  );
}

function SetupReadinessNotice({
  readiness,
}: {
  readonly readiness: SetupActionReadiness;
}): JSX.Element {
  return (
    <div className="inline-state inline-state-muted setup-execution-inline">
      <strong>{readiness.title}</strong>
      <span>{readiness.message}</span>
    </div>
  );
}

function SetupDraftBlockedNotice(): JSX.Element {
  return (
    <div className="inline-state inline-state-warning setup-execution-inline">
      <strong>Review step needs attention</strong>
      <span>Fix the grouped review issues above before creating the root.</span>
    </div>
  );
}

function CreateOrganizationInlineStatus({
  blockExplorerUrl,
  reset,
  resolvedOrgId,
  transaction,
}: {
  readonly blockExplorerUrl?: string;
  readonly reset: () => void;
  readonly resolvedOrgId?: string;
  readonly transaction: SetupActionTransaction;
}): JSX.Element | null {
  if (transaction.stage === "idle" && !resolvedOrgId) {
    return null;
  }

  const tone = getInlineExecutionTone(transaction.stage, resolvedOrgId);

  return (
    <div className={`inline-state inline-state-${tone} setup-execution-inline`}>
      <strong>{getInlineExecutionTitle(transaction.stage, resolvedOrgId)}</strong>
      <span>{getInlineExecutionDetail(transaction.stage, resolvedOrgId)}</span>
      <div className="action-row setup-inline-actions">
        <SetupTransactionHash
          blockExplorerUrl={blockExplorerUrl}
          txHash={transaction.txHash}
        />
        {transaction.stage === "confirmed_waiting_indexer" ||
        transaction.stage === "failed" ? (
          <Link className="button button-small" to="/diagnostics">
            Diagnostics
          </Link>
        ) : null}
        {transaction.stage === "failed" ? (
          <button className="button button-small" type="button" onClick={reset}>
            Reset local state
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getInlineExecutionTone(
  stage: SetupActionLifecycleStage,
  resolvedOrgId?: string,
): "success" | "warning" | "danger" | "muted" {
  if (resolvedOrgId || stage === "indexed") {
    return "success";
  }
  if (stage === "failed") {
    return "danger";
  }
  if (stage === "idle") {
    return "muted";
  }
  return "warning";
}

function getInlineExecutionTitle(
  stage: SetupActionLifecycleStage,
  resolvedOrgId?: string,
): string {
  if (resolvedOrgId || stage === "indexed") {
    return resolvedOrgId
      ? `Organization #${resolvedOrgId} root created`
      : "Organization root created";
  }
  if (stage === "failed") {
    return "Create organization failed";
  }
  return getSetupActionStageLabel(stage);
}

function getInlineExecutionDetail(
  stage: SetupActionLifecycleStage,
  resolvedOrgId?: string,
): string {
  if (resolvedOrgId || stage === "indexed") {
    return "The organization root is indexed. Continue Activation in the footer opens the activation page for bodies, roles, mandates, and policy routes.";
  }
  if (stage === "submitted") {
    return "The transaction hash is available; the modal tracks confirmation progress.";
  }
  if (stage === "confirmed_waiting_indexer") {
    return "The transaction is mined; waiting for Control Plane indexing and projection.";
  }
  if (stage === "failed") {
    return "Use the modal retry action or inspect diagnostics before trying again.";
  }
  if (stage === "idle") {
    return "Ready for the create organization setup action.";
  }
  return "The transaction modal is tracking the current wallet and chain state.";
}

function getCreateOrganizationPanelStatus({
  busy,
  state,
}: {
  readonly busy: boolean;
  readonly state: SetupDraftExecutionState;
}): PanelStatus {
  if (state.resolvedOrgId || state.createOrganization.stage === "indexed") {
    return { label: "Root indexed", tone: "success" };
  }
  if (state.createOrganization.stage === "failed") {
    return { label: "Action failed", tone: "danger" };
  }
  if (busy || isBusyStage(state.createOrganization.stage)) {
    return { label: "Transaction active", tone: "warning" };
  }
  return { label: "Ready", tone: "default" };
}

function getCreateOrganizationButtonLabel({
  busy,
  disabled,
  resolvedOrgId,
  transaction,
}: {
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly resolvedOrgId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string {
  if (resolvedOrgId || transaction.stage === "indexed") {
    return "Organization root created";
  }
  if (transaction.stage === "failed") {
    return "Retry create organization";
  }
  if (isBusyStage(transaction.stage)) {
    return getBusyButtonLabel(transaction.stage);
  }
  if (busy) {
    return "Transaction active";
  }
  if (disabled) {
    return "Create organization blocked";
  }
  return "Create organization";
}

function getBusyButtonLabel(stage: SetupActionLifecycleStage): string {
  switch (stage) {
    case "wallet_pending":
      return "Waiting for wallet";
    case "submitted":
      return "Transaction submitted";
    case "confirming":
      return "Waiting for receipt";
    case "confirmed_waiting_indexer":
      return "Waiting for Control Plane";
    case "idle":
    case "indexed":
    case "failed":
      return getSetupActionStageLabel(stage);
  }
}

function isBusyStage(stage: SetupActionLifecycleStage): boolean {
  return (
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "confirmed_waiting_indexer"
  );
}
