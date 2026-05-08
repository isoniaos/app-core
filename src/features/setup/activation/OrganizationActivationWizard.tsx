import type {
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRuntimeConfig } from "../../../config/runtime-config";
import { StatusBadge } from "../../../ui/StatusBadge";
import { IsoAddressDisplay } from "../../../ui-kit";
import { formatLabel } from "../../../utils/format";
import { useWalletConnection } from "../../../wallet/useWalletConnection";
import {
  buildActivationGroupProgress,
  canExecuteActivationActionState,
  type ActivationGroupId,
  type ActivationGroupProgress,
} from "./activation-group-progress";
import type { SimpleDaoPlusDraftInputs } from "../setup-templates";
import {
  getSetupActionExecutionPreflight,
  getSetupActionGroupExecutionPreflight,
  type SetupActionExecutionPreflight,
  type SetupActionExecutionPreflightEnvironment,
} from "../setup-action-preflight";
import type {
  SetupCompletionActionVerification,
  SetupCompletionReadModels,
  SetupCompletionVerification,
} from "../setup-completion-verification";
import type { SetupWizardFieldIssueMap } from "../setup-wizard-validation";
import {
  HoldersStep,
  PolicyRoutesStep,
  type SimpleDaoPlusInputUpdate,
} from "../shared/SimpleDaoPlusSetupWizardSteps";
import type { SetupDraftExecutionState } from "../useSetupActionExecution";

type ActivationStepId =
  | "bodies"
  | "roles"
  | "mandates"
  | "policies"
  | "review";

interface ActivationStep {
  readonly groupId?: ActivationGroupId;
  readonly id: ActivationStepId;
  readonly title: string;
  readonly summary: string;
}

interface ActivationStepState {
  readonly complete: boolean;
  readonly locked: boolean;
  readonly reason: string;
}

const ACTIVATION_STEPS: readonly ActivationStep[] = [
  {
    groupId: "bodies",
    id: "bodies",
    summary: "Create the governance bodies for this organization.",
    title: "Bodies",
  },
  {
    groupId: "roles",
    id: "roles",
    summary: "Create role scopes inside the indexed bodies.",
    title: "Roles",
  },
  {
    groupId: "mandates",
    id: "mandates",
    summary: "Assign mandate holders for role and proposal scopes.",
    title: "Mandates",
  },
  {
    groupId: "policies",
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
  readonly actions: readonly SetupAction[];
  readonly busy: boolean;
  readonly completion: SetupCompletionVerification;
  readonly completionError?: Error;
  readonly completionLoading: boolean;
  readonly completionReload: () => void;
  readonly executeAssignMandate: (actionId: string) => Promise<void>;
  readonly executeAssignMandateGroup: () => Promise<void>;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateBodyGroup: () => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly executeCreateRoleGroup: () => Promise<void>;
  readonly executeSetPolicyRule: (actionId: string) => Promise<void>;
  readonly executeSetPolicyRuleGroup: () => Promise<void>;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onChange: (inputs: SimpleDaoPlusDraftInputs) => void;
  readonly orgId: string;
  readonly readModels?: SetupCompletionReadModels;
  readonly state: SetupDraftExecutionState;
}

export function OrganizationActivationWizard({
  actions,
  busy,
  completion,
  completionError,
  completionLoading,
  completionReload,
  executeAssignMandate,
  executeAssignMandateGroup,
  executeCreateBody,
  executeCreateBodyGroup,
  executeCreateRole,
  executeCreateRoleGroup,
  executeSetPolicyRule,
  executeSetPolicyRuleGroup,
  inputs,
  onChange,
  orgId,
  readModels,
  state,
}: OrganizationActivationWizardProps): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const wallet = useWalletConnection();
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
  const preflightEnvironment =
    useMemo<SetupActionExecutionPreflightEnvironment>(
      () => ({
        accountChainId: wallet.chainId,
        connected: wallet.isConnected,
        connectedAddress: wallet.address,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        runtimeChainId: runtimeConfig.chainId,
        setupWritesEnabled:
          runtimeConfig.features.writeActions &&
          runtimeConfig.features.manageOrg,
      }),
      [
        runtimeConfig.chainId,
        runtimeConfig.contracts.govCoreAddress,
        runtimeConfig.features.manageOrg,
        runtimeConfig.features.writeActions,
        wallet.address,
        wallet.chainId,
        wallet.isConnected,
      ],
    );
  const bodyProgress = useMemo(
    () =>
      buildActivationGroupProgress({
        actions: bodyActions,
        groupId: "bodies",
        readModels,
        resultByActionId: actionResultById,
      }),
    [actionResultById, bodyActions, readModels],
  );
  const roleProgress = useMemo(
    () =>
      buildActivationGroupProgress({
        actions: roleActions,
        groupId: "roles",
        readModels,
        resultByActionId: actionResultById,
      }),
    [actionResultById, readModels, roleActions],
  );
  const mandateProgress = useMemo(
    () =>
      buildActivationGroupProgress({
        actions: mandateActions,
        groupId: "mandates",
        readModels,
        resultByActionId: actionResultById,
      }),
    [actionResultById, mandateActions, readModels],
  );
  const policyProgress = useMemo(
    () =>
      buildActivationGroupProgress({
        actions: policyActions,
        groupId: "policies",
        readModels,
        resultByActionId: actionResultById,
      }),
    [actionResultById, policyActions, readModels],
  );
  const progressByGroup = useMemo(
    () => ({
      bodies: bodyProgress,
      mandates: mandateProgress,
      policies: policyProgress,
      roles: roleProgress,
    }),
    [bodyProgress, mandateProgress, policyProgress, roleProgress],
  );
  const stepStateById = useMemo(
    () => buildActivationStepStateById(progressByGroup),
    [progressByGroup],
  );
  const activationPreflight = useMemo(
    () =>
      getSetupActionGroupExecutionPreflight(actions, preflightEnvironment),
    [actions, preflightEnvironment],
  );
  const updateInput: SimpleDaoPlusInputUpdate = (key, value) => {
    onChange({ ...inputs, [key]: value });
  };

  useEffect(() => {
    if (!stepStateById[currentStepId]?.locked) {
      return;
    }

    const fallbackStep =
      ACTIVATION_STEPS.find((step) => {
        const stepState = stepStateById[step.id];
        return !stepState.locked && !stepState.complete;
      }) ??
      ACTIVATION_STEPS.find((step) => !stepStateById[step.id].locked) ??
      ACTIVATION_STEPS[0];
    setCurrentStepId(fallbackStep.id);
  }, [currentStepId, stepStateById]);

  function goBack(): void {
    const previousStep = ACTIVATION_STEPS[currentStepIndex - 1];
    if (previousStep && !stepStateById[previousStep.id].locked) {
      setCurrentStepId(previousStep.id);
    }
  }

  function goNext(): void {
    const nextStep = ACTIVATION_STEPS[currentStepIndex + 1];
    if (nextStep && !stepStateById[nextStep.id].locked) {
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
              roles, mandates, and policy routes in order.
            </p>
          </div>
          <StatusBadge tone={getCompletionTone(completion.readiness)}>
            {formatLabel(completion.readiness)}
          </StatusBadge>
        </div>

        <ActivationAuthorityNotice preflight={activationPreflight} />
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
            stepStateById={stepStateById}
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
              <ActivationGroupPanel
                actionResultById={actionResultById}
                actions={bodyActions}
                busy={busy}
                emptyMessage="No body actions are needed for this draft."
                executeAction={executeCreateBody}
                executeGroup={executeCreateBodyGroup}
                preflightEnvironment={preflightEnvironment}
                progress={bodyProgress}
                purpose="Bodies define the governance areas that later roles and policy routes reference."
                runLabel="Run body setup"
                state={state}
                title="Bodies"
              />
            ) : null}

            {currentStepId === "roles" ? (
              <ActivationGroupPanel
                actionResultById={actionResultById}
                actions={roleActions}
                busy={busy}
                emptyMessage="No role actions are needed for this draft."
                executeAction={executeCreateRole}
                executeGroup={executeCreateRoleGroup}
                preflightEnvironment={preflightEnvironment}
                progress={roleProgress}
                purpose="Roles create the scoped authority that proposal actions use after bootstrap."
                runLabel="Run role setup"
                state={state}
                title="Roles"
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
                <ActivationGroupPanel
                  actionResultById={actionResultById}
                  actions={mandateActions}
                  busy={busy}
                  emptyMessage="Add holder addresses above to produce mandate actions."
                  executeAction={executeAssignMandate}
                  executeGroup={executeAssignMandateGroup}
                  preflightEnvironment={preflightEnvironment}
                  progress={mandateProgress}
                  purpose="Mandates bind holder wallets to active roles and proposal scopes."
                  runLabel="Run mandate setup"
                  state={state}
                  title="Mandates"
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
                <ActivationGroupPanel
                  actionResultById={actionResultById}
                  actions={policyActions}
                  busy={busy}
                  emptyMessage="No policy route actions are needed for this draft."
                  executeAction={executeSetPolicyRule}
                  executeGroup={executeSetPolicyRuleGroup}
                  preflightEnvironment={preflightEnvironment}
                  progress={policyProgress}
                  purpose="Policy routes set approval, veto, executor, and timelock constraints."
                  runLabel="Run policy setup"
                  state={state}
                  title="Policy routes"
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
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              progressByGroup={progressByGroup}
              stepState={stepStateById[currentStepId]}
              onBack={goBack}
              onNext={goNext}
            />
          </div>
        </div>
      </section>
    </section>
  );
}

function ActivationAuthorityNotice({
  preflight,
}: {
  readonly preflight: SetupActionExecutionPreflight;
}): JSX.Element | null {
  if (preflight.status === "ready") {
    return null;
  }

  const tone = preflight.status === "wrong_signer" ? "danger" : "warning";

  return (
    <div className={`inline-state inline-state-${tone} setup-execution-inline`}>
      <strong>{getAuthorityNoticeTitle(preflight)}</strong>
      <span>
        {getAuthorityNoticeMessage(preflight)} Bootstrap activation is
        performed by the organization admin in the current v0.6 EVM protocol.
        Proposal actions later use role and mandate authority. Contracts remain
        authoritative.
      </span>
      <SignerPreflightSummary compact preflight={preflight} />
    </div>
  );
}

function getAuthorityNoticeTitle(
  preflight: SetupActionExecutionPreflight,
): string {
  switch (preflight.status) {
    case "wallet_not_connected":
      return "Connect organization admin wallet";
    case "wrong_signer":
      return "Switch to organization admin wallet";
    default:
      return preflight.title;
  }
}

function getAuthorityNoticeMessage(
  preflight: SetupActionExecutionPreflight,
): string {
  switch (preflight.status) {
    case "wallet_not_connected":
      return "Bootstrap activation requires the organization admin wallet. ";
    case "wrong_signer":
      return "The connected wallet differs from the expected organization admin. Switch wallet before activation. ";
    default:
      return `${preflight.message} `;
  }
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
  stepStateById,
  steps,
}: {
  readonly currentStepId: ActivationStepId;
  readonly onStepSelect: (stepId: ActivationStepId) => void;
  readonly stepStateById: Readonly<Record<ActivationStepId, ActivationStepState>>;
  readonly steps: readonly ActivationStep[];
}): JSX.Element {
  return (
    <nav aria-label="Activation wizard steps" className="setup-wizard-steps">
      <ol>
        {steps.map((step, index) => {
          const current = step.id === currentStepId;
          const stepState = stepStateById[step.id];
          const locked = stepState.locked;

          return (
            <li key={step.id}>
              <button
                aria-current={current ? "step" : undefined}
                className={`setup-wizard-step-button${
                  current ? " setup-wizard-step-button-current" : ""
                }${locked ? " setup-wizard-step-button-locked" : ""}${
                  stepState.complete ? " setup-wizard-step-button-complete" : ""
                }`}
                disabled={locked}
                type="button"
                onClick={() => onStepSelect(step.id)}
              >
                <span className="setup-wizard-step-number">{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{locked ? stepState.reason : step.summary}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ActivationGroupPanel({
  actionResultById,
  actions,
  busy,
  emptyMessage,
  executeAction,
  executeGroup,
  preflightEnvironment,
  progress,
  purpose,
  runLabel,
  state,
  title,
}: {
  readonly actionResultById: ReadonlyMap<
    string,
    SetupCompletionActionVerification
  >;
  readonly actions: readonly SetupAction[];
  readonly busy: boolean;
  readonly emptyMessage: string;
  readonly executeAction: (actionId: string) => Promise<void>;
  readonly executeGroup: () => Promise<void>;
  readonly preflightEnvironment: SetupActionExecutionPreflightEnvironment;
  readonly progress: ActivationGroupProgress;
  readonly purpose: string;
  readonly runLabel: string;
  readonly state: SetupDraftExecutionState;
  readonly title: string;
}): JSX.Element {
  const runnableActions = actions.filter((action) =>
    canExecuteActivationActionState(
      actionResultById.get(action.actionId)?.state,
    ),
  );
  const groupPreflight = getSetupActionGroupExecutionPreflight(
    runnableActions.length > 0 ? runnableActions : actions,
    preflightEnvironment,
  );
  const disabled = busy || !progress.canRun || !groupPreflight.canExecute;

  return (
    <section className="activation-group-panel">
      <header className="activation-group-header">
        <div>
          <h4>{title}</h4>
          <p>{purpose}</p>
        </div>
        <button
          className="button button-primary"
          disabled={disabled}
          type="button"
          onClick={() => {
            void executeGroup();
          }}
        >
          {getGroupButtonLabel(progress, groupPreflight, runLabel)}
        </button>
      </header>

      <div className="activation-group-status">
        <div>
          <strong>{formatActivationGroupProgress(progress)}</strong>
          <span>{progress.reason}</span>
        </div>
        <div>
          <strong>Next required action</strong>
          <span>{progress.nextAction?.label ?? "None"}</span>
        </div>
      </div>

      {progress.canRun && !groupPreflight.canExecute ? (
        <SignerPreflightSummary preflight={groupPreflight} />
      ) : null}

      <ActivationActionList
        actionResultById={actionResultById}
        actions={actions}
        busy={busy}
        emptyMessage={emptyMessage}
        executeAction={executeAction}
        preflightEnvironment={preflightEnvironment}
        state={state}
      />
    </section>
  );
}

function ActivationActionList({
  actionResultById,
  actions,
  busy,
  emptyMessage,
  executeAction,
  preflightEnvironment,
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
  readonly preflightEnvironment: SetupActionExecutionPreflightEnvironment;
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
          preflight={getSetupActionExecutionPreflight(
            action,
            preflightEnvironment,
          )}
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
  preflight,
  result,
  transactionStage,
}: {
  readonly action: SetupAction;
  readonly busy: boolean;
  readonly executeAction: (actionId: string) => Promise<void>;
  readonly index: number;
  readonly preflight: SetupActionExecutionPreflight;
  readonly result?: SetupCompletionActionVerification;
  readonly transactionStage?: string;
}): JSX.Element {
  const actionState = result?.state ?? "not_started";
  const executableState = canExecuteActivationActionState(actionState);
  const disabled = busy || !executableState || !preflight.canExecute;
  const note = getActionControlNote(actionState, result, preflight);

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
          <StatusBadge tone={getActionStateTone(actionState)}>
            {getActionStateLabel(actionState, transactionStage)}
          </StatusBadge>
        </div>
      </div>
      <div className="action-row setup-action-controls">
        {actionState !== "indexed" ? (
          <button
            className="button button-small"
            disabled={disabled}
            type="button"
            onClick={() => {
              void executeAction(action.actionId);
            }}
          >
            {getActionButtonLabel(action, actionState, preflight)}
          </button>
        ) : null}
        {note ? <span className="setup-action-control-note">{note}</span> : null}
      </div>
      {!preflight.canExecute && actionState !== "indexed" ? (
        <SignerPreflightSummary compact preflight={preflight} />
      ) : null}
    </article>
  );
}

function SignerPreflightSummary({
  compact,
  preflight,
}: {
  readonly compact?: boolean;
  readonly preflight: SetupActionExecutionPreflight;
}): JSX.Element {
  return (
    <div
      className={`activation-signer-preflight${
        compact ? " activation-signer-preflight-compact" : ""
      }`}
    >
      {!compact || !preflight.canExecute ? (
        <div>
          <strong>{preflight.title}</strong>
          <span>{preflight.message}</span>
        </div>
      ) : null}
      <div className="activation-signer-grid">
        <div>
          <span>Expected admin</span>
          {preflight.expectedSignerAddress ? (
            <IsoAddressDisplay
              copyable
              size="compact"
              value={preflight.expectedSignerAddress}
            />
          ) : (
            <small>Required signer is not available in this draft.</small>
          )}
        </div>
        <div>
          <span>Connected</span>
          {preflight.connectedSignerAddress ? (
            <IsoAddressDisplay
              copyable
              size="compact"
              value={preflight.connectedSignerAddress}
            />
          ) : (
            <small>Not connected</small>
          )}
        </div>
      </div>
    </div>
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
      <strong>This group needs confirmation</strong>
      <span>
        Activation progress exists, but exact mandate intent requires holder
        inputs to confirm. App Core can read{" "}
        {indexedMandates.toLocaleString()} indexed mandate
        {indexedMandates === 1 ? "" : "s"} for this organization.
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
        {rows.map(([label, rowActions]) => (
          <article className="setup-review-validation-row" key={label}>
            <div>
              <strong>{label}</strong>
              <span>{formatGroupProgress(rowActions, actionResultById)}</span>
              <small>
                {getGroupReviewMessage(label, rowActions, readModels)}
              </small>
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
            Finish each unlocked group in order. Use Run this step for guided
            serial execution, or run individual actions as a fallback.
          </span>
        </div>
      )}
    </div>
  );
}

function ActivationNavigation({
  currentStep,
  currentStepIndex,
  onBack,
  onNext,
  progressByGroup,
  stepState,
}: {
  readonly currentStep: ActivationStep;
  readonly currentStepIndex: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly progressByGroup: Readonly<Record<ActivationGroupId, ActivationGroupProgress>>;
  readonly stepState: ActivationStepState;
}): JSX.Element {
  const lastStep = currentStepIndex >= ACTIVATION_STEPS.length - 1;
  const currentProgress = currentStep.groupId
    ? progressByGroup[currentStep.groupId]
    : undefined;
  const canGoNext = !lastStep && stepState.complete;
  const disabledReason =
    !lastStep && !canGoNext
      ? currentProgress?.reason ?? stepState.reason
      : undefined;

  return (
    <footer className="setup-wizard-navigation activation-navigation">
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
        disabled={!canGoNext}
        type="button"
        onClick={onNext}
      >
        Next
      </button>
      {disabledReason ? (
        <span className="setup-action-control-note">{disabledReason}</span>
      ) : null}
    </footer>
  );
}

function buildActivationStepStateById(
  progress: Readonly<Record<ActivationGroupId, ActivationGroupProgress>>,
): Readonly<Record<ActivationStepId, ActivationStepState>> {
  return {
    bodies: {
      complete: progress.bodies.complete,
      locked: false,
      reason: progress.bodies.reason,
    },
    roles: {
      complete: progress.roles.complete,
      locked: !progress.bodies.complete,
      reason: progress.bodies.complete
        ? progress.roles.reason
        : "Complete body setup to unlock roles.",
    },
    mandates: {
      complete: progress.mandates.complete,
      locked: !progress.roles.complete,
      reason: progress.roles.complete
        ? progress.mandates.reason
        : "Complete role setup to unlock mandates.",
    },
    policies: {
      complete: progress.policies.complete,
      locked: !progress.mandates.complete,
      reason: progress.mandates.complete
        ? progress.policies.reason
        : "Complete mandate setup to unlock policy routes.",
    },
    review: {
      complete:
        progress.bodies.complete &&
        progress.roles.complete &&
        progress.mandates.complete &&
        progress.policies.complete,
      locked: !progress.policies.complete,
      reason: progress.policies.complete
        ? "Review activation progress."
        : "Complete policy routes to unlock review.",
    },
  };
}

function getGroupButtonLabel(
  progress: ActivationGroupProgress,
  preflight: SetupActionExecutionPreflight,
  runLabel: string,
): string {
  if (progress.complete) {
    return "Step complete";
  }

  if (!progress.canRun) {
    return "Run this step";
  }

  return preflight.canExecute ? runLabel : preflight.buttonLabel;
}

function formatActivationGroupProgress(
  progress: ActivationGroupProgress,
): string {
  if (progress.needsInput) {
    return "Needs confirmation";
  }

  if (progress.totalActions === 0) {
    return "No actions";
  }

  const details = [
    `${progress.indexedActions} of ${progress.totalActions} indexed`,
    progress.failedActions > 0
      ? `${progress.failedActions} failed`
      : undefined,
    progress.blockedActions > 0
      ? `${progress.blockedActions} blocked`
      : undefined,
  ].filter(Boolean);

  return details.join(" / ");
}

function getActionControlNote(
  state: SetupCompletionActionVerification["state"],
  result: SetupCompletionActionVerification | undefined,
  preflight: SetupActionExecutionPreflight,
): string | undefined {
  if (!canExecuteActivationActionState(state)) {
    return result?.message;
  }

  if (!preflight.canExecute) {
    return preflight.message;
  }

  if (
    state === "failed" ||
    state === "missing_indexed_entity" ||
    state === "unresolved_policy_rule"
  ) {
    return result?.message;
  }

  return undefined;
}

function getActionButtonLabel(
  action: SetupAction,
  state: SetupCompletionActionVerification["state"],
  preflight: SetupActionExecutionPreflight,
): string {
  if (!canExecuteActivationActionState(state)) {
    return "Waiting";
  }

  if (!preflight.canExecute) {
    return preflight.buttonLabel;
  }

  return state === "failed" ? "Retry" : getExecuteLabel(action);
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
  state: SetupCompletionActionVerification["state"],
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
  state: SetupCompletionActionVerification["state"],
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
