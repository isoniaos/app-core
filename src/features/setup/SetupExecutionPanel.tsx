import type {
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
  SetupDraft,
  SetupEntityReference,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { Link } from "react-router-dom";
import { buildOrganizationSlug } from "../../chain/setup-contracts";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatAddress, formatLabel, formatNumericString } from "../../utils/format";
import type {
  SetupActionLifecycleStage,
  SetupActionReadiness,
  SetupActionTransaction,
  SetupDraftExecutionState,
} from "./useSetupActionExecution";

interface SetupExecutionPanelProps {
  readonly busy: boolean;
  readonly draft: SetupDraft;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly readiness: SetupActionReadiness | undefined;
  readonly reset: () => void;
  readonly state: SetupDraftExecutionState;
}

export function SetupExecutionPanel({
  busy,
  draft,
  executeCreateBody,
  executeCreateOrganization,
  executeCreateRole,
  readiness,
  reset,
  state,
}: SetupExecutionPanelProps): JSX.Element {
  const createOrganizationAction = draft.actions.find(
    (action) => action.kind === SetupActionKind.CreateOrganization,
  );
  const dependentActions = draft.actions.filter(
    (action) => action.kind !== SetupActionKind.CreateOrganization,
  );
  const bodyActions = dependentActions.filter(isCreateBodyAction);
  const roleActions = dependentActions.filter(isCreateRoleAction);
  const submitDisabled =
    busy ||
    state.createOrganization.stage === "indexed" ||
    readiness !== undefined;
  const panelStatus = getPanelStatus({
    bodyActions,
    busy,
    roleActions,
    state,
  });

  return (
    <section className="panel setup-execution-panel">
      <div className="panel-header">
        <div>
          <h2>Setup Execution</h2>
          <p className="panel-subtitle">
            Submit setup transactions one at a time. Draft topology remains
            non-authoritative until each action is confirmed and indexed.
          </p>
        </div>
        <StatusBadge tone={panelStatus.tone}>
          {panelStatus.label}
        </StatusBadge>
      </div>

      {readiness ? <SetupReadinessNotice readiness={readiness} /> : null}

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
          <span>
            This setup route is already attached to an indexed organization.
          </span>
        </div>
      )}

      <SetupActionLifecycle
        emittedIdLabel={
          state.createOrganization.orgId
            ? `Organization #${state.createOrganization.orgId}`
            : undefined
        }
        entityName="organization"
        idleDetail="Ready for the create organization setup action."
        indexedDetail="Control Plane returned the organization read model."
        reset={reset}
        transaction={state.createOrganization}
      />

      {state.resolvedOrganization ? (
        <ResolvedOrganizationSummary organization={state.resolvedOrganization} />
      ) : null}

      <DependentActionsPanel
        actions={dependentActions}
        busy={busy}
        executeCreateBody={executeCreateBody}
        executeCreateRole={executeCreateRole}
        resolvedOrgId={state.resolvedOrgId}
        state={state}
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
  const slug =
    transaction.slug ??
    (action.kind === SetupActionKind.CreateOrganization
      ? buildOrganizationSlug(action.fallbackName)
      : undefined);

  return (
    <div className="setup-execution-action">
      <div className="setup-execution-action-main">
        <div>
          <strong>{action.label}</strong>
          <span>
            {action.kind === SetupActionKind.CreateOrganization
              ? `${action.fallbackName}; slug ${slug}`
              : "Unsupported setup action"}
          </span>
        </div>
        <StatusBadge tone={resolvedOrgId ? "success" : "warning"}>
          {resolvedOrgId ? `Org #${resolvedOrgId}` : "Executable"}
        </StatusBadge>
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
          {busy ? "Submitting" : "Create organization"}
        </button>
        {resolvedOrgId ? (
          <Link className="button" to={`/orgs/${resolvedOrgId}`}>
            Open organization
          </Link>
        ) : null}
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

function SetupActionLifecycle({
  emittedIdLabel,
  entityName,
  idleDetail,
  indexedDetail,
  reset,
  transaction,
}: {
  readonly emittedIdLabel?: string;
  readonly entityName: string;
  readonly idleDetail: string;
  readonly indexedDetail: string;
  readonly reset?: () => void;
  readonly transaction: SetupActionTransaction;
}): JSX.Element {
  const steps = [
    {
      id: "wallet_pending",
      title: "Wallet pending",
      detail: `Confirm or reject the ${entityName} transaction in the connected wallet.`,
    },
    {
      id: "submitted",
      title: "Submitted",
      detail: transaction.txHash
        ? `Hash ${transaction.txHash}`
        : "Waiting for transaction hash.",
    },
    {
      id: "confirming",
      title: "Confirming",
      detail: "Waiting for the on-chain receipt.",
    },
    {
      id: "confirmed_waiting_indexer",
      title: "Confirmed, waiting for indexer",
      detail: emittedIdLabel
        ? `${emittedIdLabel} was emitted on-chain.`
        : "Receipt confirmed and Control Plane polling is active.",
    },
    {
      id: "indexed",
      title: "Indexed",
      detail: indexedDetail,
    },
  ] satisfies readonly {
    readonly detail: string;
    readonly id: Exclude<SetupActionLifecycleStage, "idle" | "failed">;
    readonly title: string;
  }[];

  return (
    <section className="setup-action-lifecycle">
      <div className="transaction-steps">
        {transaction.stage === "idle" ? (
          <TransactionStep
            active
            detail={idleDetail}
            title="Idle"
          />
        ) : null}
        {steps.map((step) => (
          <TransactionStep
            active={isTransactionStepActive(transaction.stage, step.id)}
            complete={isTransactionStepComplete(transaction.stage, step.id)}
            detail={step.detail}
            key={step.id}
            title={step.title}
          />
        ))}
        {transaction.stage === "failed" ? (
          <TransactionStep
            active
            danger
            detail={transaction.error ?? "The setup action failed."}
            title="Failed"
          />
        ) : null}
      </div>
      {reset &&
      (transaction.stage === "failed" || transaction.stage === "indexed") ? (
        <div className="setup-execution-footer">
          <button className="button button-small" type="button" onClick={reset}>
            Reset local execution state
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ResolvedOrganizationSummary({
  organization,
}: {
  readonly organization: {
    readonly adminAddress: string;
    readonly createdBlock: string;
    readonly createdTxHash: string;
    readonly orgId: string;
    readonly slug: string;
  };
}): JSX.Element {
  return (
    <dl className="detail-list detail-list-wide setup-execution-resolution">
      <div>
        <dt>Resolved orgId</dt>
        <dd>#{organization.orgId}</dd>
      </div>
      <div>
        <dt>Slug</dt>
        <dd>{organization.slug}</dd>
      </div>
      <div>
        <dt>Admin</dt>
        <dd>{formatAddress(organization.adminAddress)}</dd>
      </div>
      <div>
        <dt>Created block</dt>
        <dd>{organization.createdBlock}</dd>
      </div>
      <div>
        <dt>Created tx</dt>
        <dd className="mono-value">{organization.createdTxHash}</dd>
      </div>
    </dl>
  );
}

function DependentActionsPanel({
  actions,
  busy,
  executeCreateBody,
  executeCreateRole,
  resolvedOrgId,
  state,
}: {
  readonly actions: readonly SetupAction[];
  readonly busy: boolean;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly resolvedOrgId: string | undefined;
  readonly state: SetupDraftExecutionState;
}): JSX.Element {
  const bodyActions = actions.filter(isCreateBodyAction);
  const roleActions = actions.filter(isCreateRoleAction);
  const placeholderActions = actions.filter(
    (action) =>
      action.kind !== SetupActionKind.CreateBody &&
      action.kind !== SetupActionKind.CreateRole,
  );
  const indexedBodyCount = bodyActions.filter(
    (action) => state.resolvedBodyIds[action.actionId],
  ).length;
  const indexedRoleCount = roleActions.filter(
    (action) => state.resolvedRoleIds[action.actionId],
  ).length;

  return (
    <section className="setup-dependent-actions">
      <div className="setup-action-group-header">
        <h3>Body Setup Actions</h3>
        <span>
          {indexedBodyCount} of {bodyActions.length} indexed
        </span>
      </div>
      {bodyActions.length === 0 ? (
        <div className="setup-action-empty">No body actions in this draft.</div>
      ) : (
        <div className="setup-action-list">
          {bodyActions.map((action, index) => (
            <CreateBodyActionCard
              action={action}
              busy={busy}
              executeCreateBody={executeCreateBody}
              index={index + 1}
              key={action.actionId}
              resolvedOrgId={resolvedOrgId}
              state={state}
            />
          ))}
        </div>
      )}

      <div className="setup-action-group-header">
        <h3>Role Setup Actions</h3>
        <span>
          {indexedRoleCount} of {roleActions.length} indexed
        </span>
      </div>
      {roleActions.length === 0 ? (
        <div className="setup-action-empty">No role actions in this draft.</div>
      ) : (
        <div className="setup-action-list">
          {roleActions.map((action, index) => (
            <CreateRoleActionCard
              action={action}
              bodyActions={bodyActions}
              busy={busy}
              executeCreateRole={executeCreateRole}
              index={index + 1}
              key={action.actionId}
              resolvedOrgId={resolvedOrgId}
              state={state}
            />
          ))}
        </div>
      )}

      <RemainingPlaceholderActions
        actions={placeholderActions}
        bodyActions={bodyActions}
        resolvedBodyIds={state.resolvedBodyIds}
        resolvedOrgId={resolvedOrgId}
        resolvedRoleIds={state.resolvedRoleIds}
        roleActions={roleActions}
      />
    </section>
  );
}

function CreateBodyActionCard({
  action,
  busy,
  executeCreateBody,
  index,
  resolvedOrgId,
  state,
}: {
  readonly action: CreateBodySetupAction;
  readonly busy: boolean;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly index: number;
  readonly resolvedOrgId: string | undefined;
  readonly state: SetupDraftExecutionState;
}): JSX.Element {
  const transaction = state.createBodies[action.actionId] ?? {
    actionId: action.actionId,
    actionKind: action.kind,
    stage: "idle" satisfies SetupActionLifecycleStage,
  };
  const resolvedBody = state.resolvedBodies[action.actionId];
  const resolvedBodyId = state.resolvedBodyIds[action.actionId];
  const blocker = getCreateBodyBlocker({
    action,
    busy,
    resolvedBodyId,
    resolvedOrgId,
    transaction,
  });
  const emittedBodyId = transaction.bodyId ?? resolvedBodyId;

  return (
    <article className="setup-action-row">
      <div className="setup-action-row-top">
        <div className="setup-action-main">
          <span className="setup-action-index">{index}</span>
          <div>
            <strong>{action.label}</strong>
            <span>
              {formatLabel(action.bodyKind)};{" "}
              {resolvedBodyId
                ? `resolved bodyId #${resolvedBodyId}`
                : resolvedOrgId
                  ? `will create under org #${resolvedOrgId}`
                  : "waiting for resolved orgId"}
            </span>
          </div>
        </div>
        <div className="setup-action-meta">
          <StatusBadge tone="muted">{formatLabel(action.kind)}</StatusBadge>
          <StatusBadge
            tone={getBodyActionTone({ blocker, resolvedBodyId, transaction })}
          >
            {getBodyActionStatusLabel({
              blocker,
              resolvedBodyId,
              transaction,
            })}
          </StatusBadge>
        </div>
      </div>

      <div className="action-row setup-action-controls">
        <button
          className="button button-small button-primary"
          disabled={Boolean(blocker)}
          type="button"
          onClick={() => {
            void executeCreateBody(action.actionId);
          }}
        >
          {getCreateBodyButtonLabel({ resolvedBodyId, transaction })}
        </button>
        {resolvedOrgId && resolvedBodyId ? (
          <Link className="button button-small" to={`/orgs/${resolvedOrgId}/governance`}>
            Open governance
          </Link>
        ) : null}
        {blocker ? <span className="setup-action-control-note">{blocker}</span> : null}
      </div>

      {resolvedBody ? (
        <dl className="detail-list detail-list-wide setup-execution-resolution">
          <div>
            <dt>Action ID</dt>
            <dd>{action.actionId}</dd>
          </div>
          <div>
            <dt>Resolved bodyId</dt>
            <dd>#{resolvedBody.bodyId}</dd>
          </div>
          <div>
            <dt>Kind</dt>
            <dd>{formatLabel(resolvedBody.kind)}</dd>
          </div>
          <div>
            <dt>Created block</dt>
            <dd>{formatNumericString(resolvedBody.createdBlock)}</dd>
          </div>
        </dl>
      ) : null}

      {transaction.stage !== "idle" ? (
        <SetupActionLifecycle
          emittedIdLabel={emittedBodyId ? `Body #${emittedBodyId}` : undefined}
          entityName="body"
          idleDetail="Ready for this create body setup action."
          indexedDetail="Control Plane returned the body read model."
          transaction={transaction}
        />
      ) : null}
    </article>
  );
}

function CreateRoleActionCard({
  action,
  bodyActions,
  busy,
  executeCreateRole,
  index,
  resolvedOrgId,
  state,
}: {
  readonly action: CreateRoleSetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly busy: boolean;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly index: number;
  readonly resolvedOrgId: string | undefined;
  readonly state: SetupDraftExecutionState;
}): JSX.Element {
  const transaction = state.createRoles[action.actionId] ?? {
    actionId: action.actionId,
    actionKind: action.kind,
    stage: "idle" satisfies SetupActionLifecycleStage,
  };
  const resolvedBodyId = resolveBodyReference({
    bodyActions,
    reference: action.bodyRef,
    resolvedBodyIds: state.resolvedBodyIds,
  });
  const resolvedRole = state.resolvedRoles[action.actionId];
  const resolvedRoleId = state.resolvedRoleIds[action.actionId];
  const blocker = getCreateRoleBlocker({
    action,
    busy,
    resolvedBodyId,
    resolvedOrgId,
    resolvedRoleId,
    transaction,
  });
  const emittedRoleId = transaction.roleId ?? resolvedRoleId;

  return (
    <article className="setup-action-row">
      <div className="setup-action-row-top">
        <div className="setup-action-main">
          <span className="setup-action-index">{index}</span>
          <div>
            <strong>{action.label}</strong>
            <span>
              {formatLabel(action.roleType)};{" "}
              {resolvedRoleId
                ? `resolved roleId #${resolvedRoleId}`
                : resolvedBodyId
                  ? `will create in body #${resolvedBodyId}`
                  : `waiting for ${formatBodyReference(
                      action.bodyRef,
                      bodyActions,
                    )}`}
            </span>
          </div>
        </div>
        <div className="setup-action-meta">
          <StatusBadge tone="muted">{formatLabel(action.kind)}</StatusBadge>
          <StatusBadge
            tone={getRoleActionTone({ blocker, resolvedRoleId, transaction })}
          >
            {getRoleActionStatusLabel({
              blocker,
              resolvedRoleId,
              transaction,
            })}
          </StatusBadge>
        </div>
      </div>

      <div className="action-row setup-action-controls">
        <button
          className="button button-small button-primary"
          disabled={Boolean(blocker)}
          type="button"
          onClick={() => {
            void executeCreateRole(action.actionId);
          }}
        >
          {getCreateRoleButtonLabel({ resolvedRoleId, transaction })}
        </button>
        {resolvedOrgId && resolvedRoleId ? (
          <Link className="button button-small" to={`/orgs/${resolvedOrgId}/governance`}>
            Open governance
          </Link>
        ) : null}
        {blocker ? <span className="setup-action-control-note">{blocker}</span> : null}
      </div>

      {resolvedRole ? (
        <dl className="detail-list detail-list-wide setup-execution-resolution">
          <div>
            <dt>Action ID</dt>
            <dd>{action.actionId}</dd>
          </div>
          <div>
            <dt>Resolved roleId</dt>
            <dd>#{resolvedRole.roleId}</dd>
          </div>
          <div>
            <dt>Body</dt>
            <dd>#{resolvedRole.bodyId}</dd>
          </div>
          <div>
            <dt>Role type</dt>
            <dd>{formatLabel(resolvedRole.roleType)}</dd>
          </div>
        </dl>
      ) : null}

      {transaction.stage !== "idle" ? (
        <SetupActionLifecycle
          emittedIdLabel={emittedRoleId ? `Role #${emittedRoleId}` : undefined}
          entityName="role"
          idleDetail="Ready for this create role setup action."
          indexedDetail="Control Plane returned the role read model."
          transaction={transaction}
        />
      ) : null}
    </article>
  );
}

function RemainingPlaceholderActions({
  actions,
  bodyActions,
  resolvedBodyIds,
  resolvedOrgId,
  resolvedRoleIds,
  roleActions,
}: {
  readonly actions: readonly SetupAction[];
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string | undefined;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): JSX.Element {
  return (
    <section className="setup-placeholder-actions">
      <div className="setup-action-group-header">
        <h3>Mandate and Policy Placeholders</h3>
        <span>{actions.length} non-executable</span>
      </div>
      {actions.length === 0 ? (
        <div className="setup-action-empty">No remaining placeholders.</div>
      ) : (
        <div className="setup-action-list">
          {actions.map((action) => {
            const status = getPlaceholderActionStatus({
              action,
              bodyActions,
              resolvedBodyIds,
              resolvedOrgId,
              resolvedRoleIds,
              roleActions,
            });
            return (
              <article className="setup-action-row" key={action.actionId}>
                <div className="setup-action-row-top">
                  <div className="setup-action-main">
                    <span className="setup-action-index">-</span>
                    <div>
                      <strong>{action.label}</strong>
                      <span>{status.message}</span>
                    </div>
                  </div>
                  <div className="setup-action-meta">
                    <StatusBadge tone="muted">{formatLabel(action.kind)}</StatusBadge>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

interface PanelStatus {
  readonly label: string;
  readonly tone: BadgeTone;
}

function getPanelStatus({
  bodyActions,
  busy,
  roleActions,
  state,
}: {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly busy: boolean;
  readonly roleActions: readonly CreateRoleSetupAction[];
  readonly state: SetupDraftExecutionState;
}): PanelStatus {
  if (
    state.createOrganization.stage === "failed" ||
    Object.values(state.createBodies).some(
      (transaction) => transaction.stage === "failed",
    ) ||
    Object.values(state.createRoles).some(
      (transaction) => transaction.stage === "failed",
    )
  ) {
    return { label: "Action failed", tone: "danger" };
  }

  if (busy) {
    return { label: "Transaction active", tone: "warning" };
  }

  if (
    state.resolvedOrgId &&
    bodyActions.length > 0 &&
    bodyActions.every((action) => state.resolvedBodyIds[action.actionId]) &&
    roleActions.length > 0 &&
    roleActions.every((action) => state.resolvedRoleIds[action.actionId])
  ) {
    return { label: "Roles indexed", tone: "success" };
  }

  if (
    state.resolvedOrgId &&
    bodyActions.length > 0 &&
    bodyActions.every((action) => state.resolvedBodyIds[action.actionId])
  ) {
    return roleActions.length === 0
      ? { label: "Bodies indexed", tone: "success" }
      : { label: "Role setup ready", tone: "warning" };
  }

  if (state.resolvedOrgId) {
    return { label: "Body setup ready", tone: "warning" };
  }

  return { label: "Draft only", tone: "muted" };
}

function getCreateBodyBlocker({
  action,
  busy,
  resolvedBodyId,
  resolvedOrgId,
  transaction,
}: {
  readonly action: CreateBodySetupAction;
  readonly busy: boolean;
  readonly resolvedBodyId: string | undefined;
  readonly resolvedOrgId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string | undefined {
  if (resolvedBodyId || transaction.stage === "indexed") {
    return "Body already indexed.";
  }

  if (isBusyStage(transaction.stage)) {
    return "This body transaction is already in progress.";
  }

  if (busy) {
    return "Another setup transaction is active.";
  }

  if (!resolvedOrgId) {
    return "Blocked until create organization is indexed and the real orgId is resolved.";
  }

  if (!action.active) {
    return "GovCore createBody creates active bodies only.";
  }

  if (action.warnings.some((warning) => warning.severity === "error")) {
    return "Resolve this body action's validation errors before submitting.";
  }

  return undefined;
}

function getBodyActionTone({
  blocker,
  resolvedBodyId,
  transaction,
}: {
  readonly blocker: string | undefined;
  readonly resolvedBodyId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): BadgeTone {
  if (resolvedBodyId || transaction.stage === "indexed") {
    return "success";
  }
  if (transaction.stage === "failed") {
    return "danger";
  }
  if (isBusyStage(transaction.stage)) {
    return "warning";
  }
  if (blocker) {
    return "warning";
  }
  return "default";
}

function getBodyActionStatusLabel({
  blocker,
  resolvedBodyId,
  transaction,
}: {
  readonly blocker: string | undefined;
  readonly resolvedBodyId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string {
  if (resolvedBodyId) {
    return `Body #${resolvedBodyId}`;
  }
  if (transaction.stage === "indexed" && transaction.bodyId) {
    return `Body #${transaction.bodyId}`;
  }
  if (transaction.stage === "failed") {
    return "Failed";
  }
  if (isBusyStage(transaction.stage)) {
    return formatLabel(transaction.stage);
  }
  if (blocker) {
    return "Blocked";
  }
  return "Executable";
}

function getCreateBodyButtonLabel({
  resolvedBodyId,
  transaction,
}: {
  readonly resolvedBodyId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string {
  if (resolvedBodyId || transaction.stage === "indexed") {
    return "Body indexed";
  }
  if (transaction.stage === "failed") {
    return "Retry body";
  }
  if (isBusyStage(transaction.stage)) {
    return "Submitting body";
  }
  return "Create body";
}

function getCreateRoleBlocker({
  action,
  busy,
  resolvedBodyId,
  resolvedOrgId,
  resolvedRoleId,
  transaction,
}: {
  readonly action: CreateRoleSetupAction;
  readonly busy: boolean;
  readonly resolvedBodyId: string | undefined;
  readonly resolvedOrgId: string | undefined;
  readonly resolvedRoleId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string | undefined {
  if (resolvedRoleId || transaction.stage === "indexed") {
    return "Role already indexed.";
  }

  if (isBusyStage(transaction.stage)) {
    return "This role transaction is already in progress.";
  }

  if (busy) {
    return "Another setup transaction is active.";
  }

  if (!resolvedOrgId) {
    return "Blocked until create organization is indexed and the real orgId is resolved.";
  }

  if (!resolvedBodyId) {
    return "Blocked until the referenced body action resolves to a real bodyId.";
  }

  if (!action.active) {
    return "GovCore createRole creates active roles only.";
  }

  if (action.warnings.some((warning) => warning.severity === "error")) {
    return "Resolve this role action's validation errors before submitting.";
  }

  return undefined;
}

function getRoleActionTone({
  blocker,
  resolvedRoleId,
  transaction,
}: {
  readonly blocker: string | undefined;
  readonly resolvedRoleId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): BadgeTone {
  if (resolvedRoleId || transaction.stage === "indexed") {
    return "success";
  }
  if (transaction.stage === "failed") {
    return "danger";
  }
  if (isBusyStage(transaction.stage)) {
    return "warning";
  }
  if (blocker) {
    return "warning";
  }
  return "default";
}

function getRoleActionStatusLabel({
  blocker,
  resolvedRoleId,
  transaction,
}: {
  readonly blocker: string | undefined;
  readonly resolvedRoleId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string {
  if (resolvedRoleId) {
    return `Role #${resolvedRoleId}`;
  }
  if (transaction.stage === "indexed" && transaction.roleId) {
    return `Role #${transaction.roleId}`;
  }
  if (transaction.stage === "failed") {
    return "Failed";
  }
  if (isBusyStage(transaction.stage)) {
    return formatLabel(transaction.stage);
  }
  if (blocker) {
    return "Blocked";
  }
  return "Executable";
}

function getCreateRoleButtonLabel({
  resolvedRoleId,
  transaction,
}: {
  readonly resolvedRoleId: string | undefined;
  readonly transaction: SetupActionTransaction;
}): string {
  if (resolvedRoleId || transaction.stage === "indexed") {
    return "Role indexed";
  }
  if (transaction.stage === "failed") {
    return "Retry role";
  }
  if (isBusyStage(transaction.stage)) {
    return "Submitting role";
  }
  return "Create role";
}

interface PlaceholderActionStatus {
  readonly label: string;
  readonly message: string;
  readonly tone: BadgeTone;
}

function getPlaceholderActionStatus({
  action,
  bodyActions,
  resolvedBodyIds,
  resolvedOrgId,
  resolvedRoleIds,
  roleActions,
}: {
  readonly action: SetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string | undefined;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): PlaceholderActionStatus {
  if (!resolvedOrgId) {
    return {
      label: "Blocked",
      message:
        "Blocked until create organization is indexed and the real orgId is resolved.",
      tone: "warning",
    };
  }

  if (isCreateRoleAction(action)) {
    const bodyId = resolveBodyReference({
      bodyActions,
      reference: action.bodyRef,
      resolvedBodyIds,
    });
    if (!bodyId) {
      return {
        label: "Blocked",
        message: `Blocked until ${formatBodyReference(
          action.bodyRef,
          bodyActions,
        )} resolves to a real bodyId.`,
        tone: "warning",
      };
    }
    return {
      label: "Placeholder",
      message: `Body #${bodyId} is resolved; create_role execution is not implemented in this task.`,
      tone: "muted",
    };
  }

  if (isSetPolicyRuleAction(action)) {
    const bodyRefs = getPolicyBodyReferences(action);
    const unresolvedRefs = bodyRefs.filter(
      (reference) =>
        !resolveBodyReference({ bodyActions, reference, resolvedBodyIds }),
    );
    if (unresolvedRefs.length > 0) {
      return {
        label: "Blocked",
        message: `Blocked until ${unresolvedRefs.length.toLocaleString()} referenced bodyId${unresolvedRefs.length === 1 ? "" : "s"} resolve.`,
        tone: "warning",
      };
    }
    const unresolvedRoleDependencies = action.dependsOn.filter((dependency) =>
      isUnresolvedRoleDependency({
        actionId: dependency,
        resolvedRoleIds,
        roleActions,
      }),
    );
    if (unresolvedRoleDependencies.length > 0) {
      return {
        label: "Blocked",
        message: `Blocked until ${unresolvedRoleDependencies.length.toLocaleString()} referenced roleId${unresolvedRoleDependencies.length === 1 ? "" : "s"} resolve.`,
        tone: "warning",
      };
    }
    return {
      label: "Placeholder",
      message:
        "All required bodyIds and roleIds are resolved; set_policy_rule execution is not implemented in this task.",
      tone: "muted",
    };
  }

  if (isAssignMandateAction(action)) {
    const roleId = resolveRoleReference({
      reference: action.roleRef,
      resolvedRoleIds,
      roleActions,
    });
    if (roleId) {
      return {
        label: "Placeholder",
        message: `Role #${roleId} is resolved; assign_mandate execution is not implemented in this task.`,
        tone: "muted",
      };
    }

    return {
      label: "Blocked",
      message:
        "Blocked until create_role execution resolves role IDs; assign_mandate is not implemented in this task.",
      tone: "warning",
    };
  }

  return {
    label: "Placeholder",
    message: `${formatLabel(action.kind)} execution is not implemented in this task.`,
    tone: "muted",
  };
}

function resolveBodyReference({
  bodyActions,
  reference,
  resolvedBodyIds,
}: {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly reference: SetupEntityReference;
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
}): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  const bodyAction = reference.draftId
    ? bodyActions.find((action) => action.bodyDraftId === reference.draftId)
    : undefined;
  return bodyAction ? resolvedBodyIds[bodyAction.actionId] : undefined;
}

function resolveRoleReference({
  reference,
  resolvedRoleIds,
  roleActions,
}: {
  readonly reference: SetupEntityReference;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  const roleAction = reference.draftId
    ? roleActions.find((action) => action.roleDraftId === reference.draftId)
    : undefined;
  return roleAction ? resolvedRoleIds[roleAction.actionId] : undefined;
}

function isUnresolvedRoleDependency({
  actionId,
  resolvedRoleIds,
  roleActions,
}: {
  readonly actionId: string;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): boolean {
  const roleAction = roleActions.find((action) => action.actionId === actionId);
  return Boolean(roleAction && !resolvedRoleIds[roleAction.actionId]);
}

function formatBodyReference(
  reference: SetupEntityReference,
  bodyActions: readonly CreateBodySetupAction[],
): string {
  if (reference.indexedId) {
    return `Body #${reference.indexedId}`;
  }

  const bodyAction = reference.draftId
    ? bodyActions.find((action) => action.bodyDraftId === reference.draftId)
    : undefined;
  return bodyAction?.label ?? reference.draftId ?? "the referenced body";
}

function getPolicyBodyReferences(
  action: SetPolicyRuleSetupAction,
): readonly SetupEntityReference[] {
  return [
    ...action.requiredApprovalBodies,
    ...action.vetoBodies,
    ...(action.executorBody ? [action.executorBody] : []),
  ];
}

function isCreateBodyAction(action: SetupAction): action is CreateBodySetupAction {
  return action.kind === SetupActionKind.CreateBody;
}

function isCreateRoleAction(action: SetupAction): action is CreateRoleSetupAction {
  return action.kind === SetupActionKind.CreateRole;
}

function isAssignMandateAction(
  action: SetupAction,
): action is AssignMandateSetupAction {
  return action.kind === SetupActionKind.AssignMandate;
}

function isSetPolicyRuleAction(
  action: SetupAction,
): action is SetPolicyRuleSetupAction {
  return action.kind === SetupActionKind.SetPolicyRule;
}

function isBusyStage(stage: SetupActionLifecycleStage): boolean {
  return (
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "confirmed_waiting_indexer"
  );
}

function TransactionStep({
  active,
  complete,
  danger,
  detail,
  title,
}: {
  readonly active?: boolean;
  readonly complete?: boolean;
  readonly danger?: boolean;
  readonly detail: string;
  readonly title: string;
}): JSX.Element {
  const className = [
    "transaction-step",
    active ? "transaction-step-active" : "",
    complete ? "transaction-step-complete" : "",
    danger ? "transaction-step-danger" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function isTransactionStepActive(
  current: SetupActionLifecycleStage,
  step: Exclude<SetupActionLifecycleStage, "idle" | "failed">,
): boolean {
  return current === step;
}

function isTransactionStepComplete(
  current: SetupActionLifecycleStage,
  step: Exclude<SetupActionLifecycleStage, "idle" | "failed">,
): boolean {
  const order: Record<
    Exclude<SetupActionLifecycleStage, "idle" | "failed">,
    number
  > = {
    wallet_pending: 1,
    submitted: 2,
    confirming: 3,
    confirmed_waiting_indexer: 4,
    indexed: 5,
  };

  return (
    current !== "failed" && current !== "idle" && order[current] > order[step]
  );
}
