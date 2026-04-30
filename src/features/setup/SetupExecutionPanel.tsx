import type { SetupAction, SetupDraft } from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { Link } from "react-router-dom";
import { buildOrganizationSlug } from "../../chain/setup-contracts";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatAddress, formatLabel } from "../../utils/format";
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

export function SetupExecutionPanel({
  busy,
  draft,
  executeCreateOrganization,
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
  const submitDisabled =
    busy ||
    state.createOrganization.stage === "indexed" ||
    readiness !== undefined;

  return (
    <section className="panel setup-execution-panel">
      <div className="panel-header">
        <div>
          <h2>Setup Execution</h2>
          <p className="panel-subtitle">
            This step can submit only create organization. Template topology
            actions stay visible as placeholders until their executors exist.
          </p>
        </div>
        <StatusBadge tone={transactionTone(state.createOrganization.stage)}>
          {formatLabel(state.createOrganization.stage)}
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

      <SetupActionLifecycle reset={reset} transaction={state.createOrganization} />

      {state.resolvedOrganization ? (
        <ResolvedOrganizationSummary organization={state.resolvedOrganization} />
      ) : null}

      <DependentActionsPanel
        actions={dependentActions}
        resolvedOrgId={state.resolvedOrgId}
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
  reset,
  transaction,
}: {
  readonly reset: () => void;
  readonly transaction: SetupActionTransaction;
}): JSX.Element {
  const steps = [
    {
      id: "wallet_pending",
      title: "Wallet pending",
      detail: "Confirm or reject the organization transaction in the connected wallet.",
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
      detail: transaction.orgId
        ? `Organization #${transaction.orgId} was emitted on-chain.`
        : "Receipt confirmed and Control Plane polling is active.",
    },
    {
      id: "indexed",
      title: "Indexed",
      detail: "Control Plane returned the organization read model.",
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
            detail="Ready for the create organization setup action."
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
      {transaction.stage === "failed" || transaction.stage === "indexed" ? (
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
  resolvedOrgId,
}: {
  readonly actions: readonly SetupAction[];
  readonly resolvedOrgId: string | undefined;
}): JSX.Element {
  return (
    <section className="setup-dependent-actions">
      <div className="setup-action-group-header">
        <h3>Remaining Setup Actions</h3>
        <span>{actions.length} placeholders</span>
      </div>
      {actions.length === 0 ? (
        <div className="setup-action-empty">No dependent actions in this draft.</div>
      ) : (
        <div className="setup-action-list">
          {actions.map((action) => (
            <article className="setup-action-row" key={action.actionId}>
              <div className="setup-action-row-top">
                <div className="setup-action-main">
                  <span className="setup-action-index">-</span>
                  <div>
                    <strong>{action.label}</strong>
                    <span>
                      {resolvedOrgId
                        ? `Org #${resolvedOrgId} resolved; execution for ${formatLabel(
                            action.kind,
                          )} is not implemented in this task.`
                        : "Blocked until create organization is indexed and the real orgId is resolved."}
                    </span>
                  </div>
                </div>
                <div className="setup-action-meta">
                  <StatusBadge tone="muted">{formatLabel(action.kind)}</StatusBadge>
                  <StatusBadge tone={resolvedOrgId ? "muted" : "warning"}>
                    {resolvedOrgId ? "Placeholder" : "Blocked"}
                  </StatusBadge>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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

function transactionTone(
  stage: SetupActionLifecycleStage,
): "default" | "success" | "warning" | "danger" | "muted" {
  if (stage === "indexed") {
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
