import type {
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import type { SimpleDaoPlusDraftInputs } from "./setup-templates";
import type {
  SetupCompletionActionState,
  SetupCompletionActionVerification,
  SetupCompletionReadModels,
  SetupCompletionVerification,
} from "./setup-completion-verification";
import type { SetupWizardFieldIssueMap } from "./setup-wizard-validation";
import {
  HoldersStep,
  PolicyRoutesStep,
  type SimpleDaoPlusInputUpdate,
} from "./SimpleDaoPlusSetupWizardSteps";
import type { SetupDraftExecutionState } from "./useSetupActionExecution";

type ActivationStepId =
  | "bodies"
  | "roles"
  | "mandates"
  | "policies"
  | "review";

interface ActivationStep {
  readonly id: ActivationStepId;
  readonly title: string;
  readonly summary: string;
}

const ACTIVATION_STEPS: readonly ActivationStep[] = [
  {
    id: "bodies",
    summary: "Create the governance bodies for this organization.",
    title: "Bodies",
  },
  {
    id: "roles",
    summary: "Create role scopes inside the indexed bodies.",
    title: "Roles",
  },
  {
    id: "mandates",
    summary: "Assign mandate holders for role and proposal scopes.",
    title: "Mandates",
  },
  {
    id: "policies",
    summary: "Set approval, veto, executor, and timelock routes.",
    title: "Policy routes",
  },
  {
    id: "review",
    summary: "Review activation progress and finish.",
    title: "Review / Finish",
  },
];

const EMPTY_FIELD_ISSUES: SetupWizardFieldIssueMap = {};

export interface OrganizationActivationWizardProps {
  readonly busy: boolean;
  readonly completion: SetupCompletionVerification;
  readonly completionError?: Error;
  readonly completionLoading: boolean;
  readonly completionReload: () => void;
  readonly executeAssignMandate: (actionId: string) => Promise<void>;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly executeSetPolicyRule: (actionId: string) => Promise<void>;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onChange: (inputs: SimpleDaoPlusDraftInputs) => void;
  readonly orgId: string;
  readonly readModels?: SetupCompletionReadModels;
  readonly state: SetupDraftExecutionState;
  readonly actions: readonly SetupAction[];
}

export function OrganizationActivationWizard({
  actions,
  busy,
  completion,
  completionError,
  completionLoading,
  completionReload,
  executeAssignMandate,
  executeCreateBody,
  executeCreateRole,
  executeSetPolicyRule,
  inputs,
  onChange,
  orgId,
  readModels,
  state,
}: OrganizationActivationWizardProps): JSX.Element {
  const [currentStepId, setCurrentStepId] =
    useState<ActivationStepId>("bodies");
  const currentStepIndex = ACTIVATION_STEPS.findIndex(
    (step) => step.id === currentStepId,
  );
  const currentStep =
    ACTIVATION_STEPS[currentStepIndex] ?? ACTIVATION_STEPS[0];
  const bodyActions = useMemo(
    () => actions.filter(isCreateBodyAction),
    [actions],
  );
  const roleActions = useMemo(
    () => actions.filter(isCreateRoleAction),
    [actions],
  );
  const mandateActions = useMemo(
    () => actions.filter(isAssignMandateAction),
    [actions],
  );
  const policyActions = useMemo(
    () => actions.filter(isSetPolicyRuleAction),
    [actions],
  );
  const actionResultById = useMemo(
    () =>
      new Map(
        completion.actionResults.map((result) => [result.actionId, result]),
      ),
    [completion.actionResults],
  );
  const updateInput: SimpleDaoPlusInputUpdate = (key, value) => {
    onChange({ ...inputs, [key]: value });
  };

  function goBack(): void {
    const previousStep = ACTIVATION_STEPS[currentStepIndex - 1];
    if (previousStep) {
      setCurrentStepId(previousStep.id);
    }
  }

  function goNext(): void {
    const nextStep = ACTIVATION_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setCurrentStepId(nextStep.id);
    }
  }

  return (
    <section className="setup-wizard activation-wizard">
      <section className="panel setup-wizard-panel">
        <div className="panel-header">
          <div>
            <h2>Organization Activation Wizard</h2>
            <p className="panel-subtitle">
              The organization root already exists. Activation creates bodies,
              roles, mandates, and policy routes.
            </p>
          </div>
          <StatusBadge tone={getCompletionTone(completion.readiness)}>
            {formatLabel(completion.readiness)}
          </StatusBadge>
        </div>

        <ActivationAuthorityNotice />
        <ActivationMetrics completion={completion} />

        {completionError ? (
          <div className="inline-state inline-state-warning setup-execution-inline">
            <strong>Read models unavailable</strong>
            <span>{completionError.message}</span>
            <button
              className="button button-small"
              type="button"
              onClick={completionReload}
            >
              Retry
            </button>
          </div>
        ) : null}

        {completionLoading ? (
          <div className="inline-state inline-state-muted setup-execution-inline">
            <strong>Refreshing indexed progress</strong>
            <span>
              Reading organization, body, role, mandate, and policy read models.
            </span>
          </div>
        ) : null}

        <div className="setup-wizard-layout">
          <ActivationStepList
            currentStepId={currentStepId}
            steps={ACTIVATION_STEPS}
            onStepSelect={setCurrentStepId}
          />

          <div className="setup-wizard-main">
            <div className="setup-wizard-step-heading">
              <span className="eyebrow">Step {currentStepIndex + 1}</span>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.summary}</p>
            </div>

            {currentStepId === "bodies" ? (
              <ActivationActionList
                actionResultById={actionResultById}
                actions={bodyActions}
                busy={busy}
                emptyMessage="No body actions are needed for this draft."
                executeAction={executeCreateBody}
                state={state}
              />
            ) : null}

            {currentStepId === "roles" ? (
              <ActivationActionList
                actionResultById={actionResultById}
                actions={roleActions}
                busy={busy}
                emptyMessage="No role actions are needed for this draft."
                executeAction={executeCreateRole}
                state={state}
              />
            ) : null}

            {currentStepId === "mandates" ? (
              <div className="setup-wizard-step-body">
                <HoldersStep
                  disabled={busy}
                  fieldIssues={EMPTY_FIELD_ISSUES}
                  inputs={inputs}
                  onFieldBlur={() => undefined}
                  onUpdate={updateInput}
                />
                <MandateResumeNotice
                  mandateActions={mandateActions}
                  readModels={readModels}
                />
                <ActivationActionList
                  actionResultById={actionResultById}
                  actions={mandateActions}
                  busy={busy}
                  emptyMessage="Add holder addresses above to produce mandate actions."
                  executeAction={executeAssignMandate}
                  state={state}
                />
              </div>
            ) : null}

            {currentStepId === "policies" ? (
              <div className="setup-wizard-step-body">
                <PolicyRoutesStep
                  disabled={busy}
                  fieldIssues={EMPTY_FIELD_ISSUES}
                  inputs={inputs}
                  onFieldBlur={() => undefined}
                  onUpdate={updateInput}
                />
                <ActivationActionList
                  actionResultById={actionResultById}
                  actions={policyActions}
                  busy={busy}
                  emptyMessage="No policy route actions are needed for this draft."
                  executeAction={executeSetPolicyRule}
                  state={state}
                />
              </div>
            ) : null}

            {currentStepId === "review" ? (
              <ActivationReview
                actionResultById={actionResultById}
                bodyActions={bodyActions}
                completion={completion}
                mandateActions={mandateActions}
                orgId={orgId}
                policyActions={policyActions}
                readModels={readModels}
                roleActions={roleActions}
              />
            ) : null}

            <ActivationNavigation
              currentStepIndex={currentStepIndex}
              onBack={goBack}
              onNext={goNext}
            />
          </div>
        </div>
      </section>
    </section>
  );
}

function ActivationAuthorityNotice(): JSX.Element {
  return (
    <div className="inline-state inline-state-muted setup-execution-inline">
      <strong>Bootstrap authority</strong>
      <span>
        Bootstrap activation is performed by the organization admin in the
        current v0.6 EVM protocol. Proposal actions later use role and mandate
        authority. Contracts remain authoritative. Read models may lag after
        transactions.
      </span>
    </div>
  );
}

function ActivationMetrics({
  completion,
}: {
  readonly completion: SetupCompletionVerification;
}): JSX.Element {
  const blocked =
    completion.blockedActions +
    completion.unresolvedDependencies.length +
    completion.missingIndexedEntities.length +
    completion.unresolvedPolicyRules.length;
  const items = [
    ["Total actions", completion.totalActions],
    ["Indexed", completion.indexedActions],
    ["Failed", completion.failedActions],
    ["Active", completion.inProgressActions],
    ["Blocked", blocked],
  ] satisfies readonly (readonly [string, number])[];

  return (
    <dl className="setup-execution-summary" aria-label="Activation summary">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivationStepList({
  currentStepId,
  onStepSelect,
  steps,
}: {
  readonly currentStepId: ActivationStepId;
  readonly onStepSelect: (stepId: ActivationStepId) => void;
  readonly steps: readonly ActivationStep[];
}): JSX.Element {
  return (
    <nav aria-label="Activation wizard steps" className="setup-wizard-steps">
      <ol>
        {steps.map((step, index) => {
          const current = step.id === currentStepId;
          return (
            <li key={step.id}>
              <button
                aria-current={current ? "step" : undefined}
                className={`setup-wizard-step-button${
                  current ? " setup-wizard-step-button-current" : ""
                }`}
                type="button"
                onClick={() => onStepSelect(step.id)}
              >
                <span className="setup-wizard-step-number">{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.summary}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ActivationActionList({
  actionResultById,
  actions,
  busy,
  emptyMessage,
  executeAction,
  state,
}: {
  readonly actionResultById: ReadonlyMap<
    string,
    SetupCompletionActionVerification
  >;
  readonly actions: readonly SetupAction[];
  readonly busy: boolean;
  readonly emptyMessage: string;
  readonly executeAction: (actionId: string) => Promise<void>;
  readonly state: SetupDraftExecutionState;
}): JSX.Element {
  if (actions.length === 0) {
    return <div className="setup-action-empty">{emptyMessage}</div>;
  }

  return (
    <div className="setup-action-list activation-action-list">
      {actions.map((action, index) => (
        <ActivationActionRow
          action={action}
          busy={busy}
          executeAction={executeAction}
          index={index + 1}
          key={action.actionId}
          result={actionResultById.get(action.actionId)}
          transactionStage={getTransactionStage(action, state)}
        />
      ))}
    </div>
  );
}

function ActivationActionRow({
  action,
  busy,
  executeAction,
  index,
  result,
  transactionStage,
}: {
  readonly action: SetupAction;
  readonly busy: boolean;
  readonly executeAction: (actionId: string) => Promise<void>;
  readonly index: number;
  readonly result?: SetupCompletionActionVerification;
  readonly transactionStage?: string;
}): JSX.Element {
  const state = result?.state ?? "not_started";
  const disabled = busy || !canExecuteActivationAction(state);

  return (
    <article className="setup-action-row">
      <div className="setup-action-row-top">
        <div className="setup-action-main">
          <span className="setup-action-index">{index}</span>
          <div>
            <strong>{action.label}</strong>
            <span>{getActionSummary(action, result)}</span>
          </div>
        </div>
        <div className="setup-action-meta">
          <StatusBadge tone="muted">{formatLabel(action.kind)}</StatusBadge>
          <StatusBadge tone={getActionStateTone(state)}>
            {getActionStateLabel(state, transactionStage)}
          </StatusBadge>
        </div>
      </div>
      <div className="action-row setup-action-controls">
        {state !== "indexed" ? (
          <button
            className="button button-small button-primary"
            disabled={disabled}
            type="button"
            onClick={() => {
              void executeAction(action.actionId);
            }}
          >
            {state === "failed" ? "Retry" : getExecuteLabel(action)}
          </button>
        ) : null}
        {result?.message ? (
          <span className="setup-action-control-note">{result.message}</span>
        ) : null}
      </div>
    </article>
  );
}

function MandateResumeNotice({
  mandateActions,
  readModels,
}: {
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly readModels?: SetupCompletionReadModels;
}): JSX.Element | null {
  if (mandateActions.length > 0) {
    return null;
  }

  const indexedMandates = readModels?.mandates.length ?? 0;
  return (
    <div className="inline-state inline-state-warning setup-wizard-note">
      <strong>Mandate resume needs confirmation</strong>
      <span>
        App Core can read {indexedMandates.toLocaleString()} indexed mandate
        {indexedMandates === 1 ? "" : "s"}, but it needs holder inputs to
        verify the intended Simple DAO+ mandate set exactly after a reload or
        in another browser.
      </span>
    </div>
  );
}

function ActivationReview({
  actionResultById,
  bodyActions,
  completion,
  mandateActions,
  orgId,
  policyActions,
  readModels,
  roleActions,
}: {
  readonly actionResultById: ReadonlyMap<
    string,
    SetupCompletionActionVerification
  >;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly completion: SetupCompletionVerification;
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly orgId: string;
  readonly policyActions: readonly SetPolicyRuleSetupAction[];
  readonly readModels?: SetupCompletionReadModels;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): JSX.Element {
  const rows = [
    ["Bodies", bodyActions],
    ["Roles", roleActions],
    ["Mandates", mandateActions],
    ["Policy routes", policyActions],
  ] satisfies readonly (readonly [string, readonly SetupAction[]])[];

  return (
    <div className="setup-wizard-review">
      <div className="inline-state inline-state-muted setup-wizard-note">
        <strong>Resume source</strong>
        <span>
          Activation progress is derived from indexed Control Plane read models
          for org #{orgId}: bodies by kind, roles by type/body, mandates by
          role/holder/scope when holder inputs are available, and policies by
          proposal type, route shape, timelock, and enabled state.
        </span>
      </div>
      <div className="setup-review-validation-list">
        {rows.map(([label, actions]) => (
          <article className="setup-review-validation-row" key={label}>
            <div>
              <strong>{label}</strong>
              <span>{formatGroupProgress(actions, actionResultById)}</span>
              <small>{getGroupReviewMessage(label, actions, readModels)}</small>
            </div>
          </article>
        ))}
      </div>
      {completion.readiness === "completed" ? (
        <div className="inline-state inline-state-success setup-wizard-note">
          <strong>Activation indexed</strong>
          <span>All expected activation actions match indexed read models.</span>
          <Link className="button button-small" to={`/orgs/${orgId}/governance`}>
            Open governance
          </Link>
        </div>
      ) : (
        <div className="inline-state inline-state-muted setup-wizard-note">
          <strong>Activation remains in progress</strong>
          <span>
            Continue the grouped actions one at a time. Serial group execution
            remains a backlog item for this release review.
          </span>
        </div>
      )}
    </div>
  );
}

function ActivationNavigation({
  currentStepIndex,
  onBack,
  onNext,
}: {
  readonly currentStepIndex: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
}): JSX.Element {
  const lastStep = currentStepIndex >= ACTIVATION_STEPS.length - 1;
  return (
    <footer className="setup-wizard-navigation">
      <button
        className="button"
        disabled={currentStepIndex === 0}
        type="button"
        onClick={onBack}
      >
        Back
      </button>
      <button
        className="button button-primary"
        disabled={lastStep}
        type="button"
        onClick={onNext}
      >
        Next
      </button>
    </footer>
  );
}

function canExecuteActivationAction(state: SetupCompletionActionState): boolean {
  return (
    state === "not_started" ||
    state === "failed" ||
    state === "missing_indexed_entity" ||
    state === "unresolved_policy_rule"
  );
}

function getActionSummary(
  action: SetupAction,
  result?: SetupCompletionActionVerification,
): string {
  if (result?.indexedEntityId) {
    return `${formatLabel(action.kind)} indexed as #${result.indexedEntityId}`;
  }
  if (action.description) {
    return action.description;
  }
  return formatLabel(action.kind);
}

function getExecuteLabel(action: SetupAction): string {
  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return "Create organization";
    case SetupActionKind.CreateBody:
      return "Create body";
    case SetupActionKind.CreateRole:
      return "Create role";
    case SetupActionKind.AssignMandate:
      return "Assign mandate";
    case SetupActionKind.SetPolicyRule:
      return "Set policy";
  }
}

function getActionStateLabel(
  state: SetupCompletionActionState,
  transactionStage?: string,
): string {
  if (transactionStage && transactionStage !== "idle") {
    return formatLabel(transactionStage);
  }

  switch (state) {
    case "indexed":
      return "Indexed";
    case "failed":
      return "Failed";
    case "in_progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "unresolved_dependency":
      return "Pending dependencies";
    case "missing_indexed_entity":
    case "unresolved_policy_rule":
    case "not_started":
      return "Ready";
  }
}

function getActionStateTone(
  state: SetupCompletionActionState,
): "default" | "success" | "warning" | "danger" | "muted" {
  switch (state) {
    case "indexed":
      return "success";
    case "failed":
      return "danger";
    case "blocked":
    case "in_progress":
    case "unresolved_dependency":
      return "warning";
    case "missing_indexed_entity":
    case "not_started":
    case "unresolved_policy_rule":
      return "default";
  }
}

function getCompletionTone(
  readiness: SetupCompletionVerification["readiness"],
): "default" | "success" | "warning" | "danger" | "muted" {
  switch (readiness) {
    case "completed":
      return "success";
    case "blocked":
      return "danger";
    case "in_progress":
    case "partially_indexed":
      return "warning";
    case "not_started":
      return "muted";
  }
}

function formatGroupProgress(
  actions: readonly SetupAction[],
  resultById: ReadonlyMap<string, SetupCompletionActionVerification>,
): string {
  const indexed = actions.filter(
    (action) => resultById.get(action.actionId)?.state === "indexed",
  ).length;
  return `${indexed} of ${actions.length} indexed`;
}

function getGroupReviewMessage(
  label: string,
  actions: readonly SetupAction[],
  readModels?: SetupCompletionReadModels,
): string {
  if (label === "Mandates" && actions.length === 0) {
    const indexedMandates = readModels?.mandates.length ?? 0;
    return indexedMandates > 0
      ? "Indexed mandates exist, but holder inputs are needed to confirm exact Simple DAO+ intent."
      : "No mandate actions are generated until holder addresses are provided.";
  }
  return actions.length === 0
    ? "No actions generated for this group."
    : "Completion is checked against indexed read models where matching fields are available.";
}

function getTransactionStage(
  action: SetupAction,
  state: SetupDraftExecutionState,
): string | undefined {
  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return state.createOrganization.stage;
    case SetupActionKind.CreateBody:
      return state.createBodies[action.actionId]?.stage;
    case SetupActionKind.CreateRole:
      return state.createRoles[action.actionId]?.stage;
    case SetupActionKind.AssignMandate:
      return state.assignMandates[action.actionId]?.stage;
    case SetupActionKind.SetPolicyRule:
      return state.setPolicyRules[action.actionId]?.stage;
  }
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
