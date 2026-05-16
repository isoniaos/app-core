import type {
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { useEffect, useMemo, useState } from "react";
import type { ActivationCapabilitiesQuery } from "../../../api/useActivationCapabilities";
import type { OrganizationFinalizationQuery } from "../../../api/useOrganizationFinalization";
import {
  IsoIcon,
  IsoSteps,
  type IsoStepItem,
} from "../../../ui-kit";
import {
  buildActivationGroupProgress,
  type ActivationGroupId,
  type ActivationGroupProgress,
} from "./activation-group-progress";
import type { SimpleDaoPlusDraftInputs } from "../setup-templates";
import type {
  SetupCompletionActionVerification,
  SetupCompletionReadModels,
  SetupCompletionVerification,
} from "../setup-completion-verification";
import {
  toFieldIssueMap,
  validateSetupWizardStep,
  type SetupWizardFieldId,
  type SetupWizardFieldIssueMap,
  type SetupWizardTouchedFields,
} from "../setup-wizard-validation";
import type { OrganizationFinalizationAction } from "../useOrganizationFinalizationAction";
import {
  HoldersStep,
  PolicyRoutesStep,
  type SimpleDaoPlusInputUpdate,
} from "../shared/SimpleDaoPlusSetupWizardSteps";

type ActivationStepId =
  | "bodies"
  | "roles"
  | "mandates"
  | "policies"
  | "finalization";

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
    id: "finalization",
    summary: "Activate the organization after setup is complete.",
    title: "Finalization",
  },
];

export interface OrganizationActivationWizardProps {
  readonly activationCapabilities: ActivationCapabilitiesQuery;
  readonly actions: readonly SetupAction[];
  readonly busy: boolean;
  readonly completion: SetupCompletionVerification;
  readonly completionError?: Error;
  readonly completionLoading: boolean;
  readonly completionReload: () => void;
  readonly executeAssignMandateGroup: () => Promise<void>;
  readonly executeCreateBodyGroup: () => Promise<void>;
  readonly executeCreateRoleGroup: () => Promise<void>;
  readonly executeSetPolicyRuleGroup: () => Promise<void>;
  readonly finalization: OrganizationFinalizationQuery;
  readonly finalizationAction: OrganizationFinalizationAction;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onChange: (inputs: SimpleDaoPlusDraftInputs) => void;
  readonly readModels?: SetupCompletionReadModels;
}

export function OrganizationActivationWizard({
  activationCapabilities,
  actions,
  busy,
  completion,
  completionError,
  completionLoading,
  completionReload,
  executeAssignMandateGroup,
  executeCreateBodyGroup,
  executeCreateRoleGroup,
  executeSetPolicyRuleGroup,
  finalization,
  finalizationAction,
  inputs,
  onChange,
  readModels,
}: OrganizationActivationWizardProps): JSX.Element {
  const [currentStepId, setCurrentStepId] =
    useState<ActivationStepId>("bodies");
  const [touchedFields, setTouchedFields] =
    useState<SetupWizardTouchedFields>({});
  const currentStepIndex = ACTIVATION_STEPS.findIndex(
    (step) => step.id === currentStepId,
  );
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
  const holderFieldIssues = useMemo(
    () =>
      getVisibleActivationFieldIssues({
        inputs,
        stepId: "holders",
        touchedFields,
      }),
    [inputs, touchedFields],
  );
  const routeFieldIssues = useMemo(
    () =>
      getVisibleActivationFieldIssues({
        inputs,
        stepId: "routes",
        touchedFields,
      }),
    [inputs, touchedFields],
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
    () =>
      buildActivationStepStateById({
        finalized: finalization.finalized,
        progress: progressByGroup,
      }),
    [finalization.finalized, progressByGroup],
  );
  const updateInput: SimpleDaoPlusInputUpdate = (key, value) => {
    onChange({ ...inputs, [key]: value });
  };
  const markFieldTouched = (fieldId: SetupWizardFieldId): void => {
    setTouchedFields((current) => ({ ...current, [fieldId]: true }));
  };
  const bootstrapAdminActionsBlocked = finalization.finalized;

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
            {currentStepId === "bodies" ? (
              <ActivationGroupPanel
                actionResultById={actionResultById}
                actions={bodyActions}
                emptyMessage="No body actions are needed for this draft."
                listTitle="The following bodies will be created:"
                purpose="Bodies define the governance areas that later roles and policy routes reference."
              />
            ) : null}

            {currentStepId === "roles" ? (
              <ActivationGroupPanel
                actionResultById={actionResultById}
                actions={roleActions}
                emptyMessage="No role actions are needed for this draft."
                listTitle="The following roles will be created:"
                purpose="Roles create the scoped authority that proposal actions use after bootstrap."
              />
            ) : null}

            {currentStepId === "mandates" ? (
              <div className="setup-wizard-step-body">
                <p className="activation-group-purpose">
                  Mandates bind holder wallets to active roles and proposal
                  scopes.
                </p>
                <HoldersStep
                  disabled={busy || bootstrapAdminActionsBlocked}
                  fieldIssues={holderFieldIssues}
                  inputs={inputs}
                  onFieldBlur={markFieldTouched}
                  onUpdate={updateInput}
                />
                <ActivationGroupPanel
                  actionResultById={actionResultById}
                  actions={mandateActions}
                  listTitle="The following mandates will be assigned:"
                />
              </div>
            ) : null}

            {currentStepId === "policies" ? (
              <div className="setup-wizard-step-body">
                <p className="activation-group-purpose">
                  Policy routes set approval, veto, executor, and timelock
                  constraints.
                </p>
                <PolicyRoutesStep
                  disabled={busy || bootstrapAdminActionsBlocked}
                  fieldIssues={routeFieldIssues}
                  inputs={inputs}
                  onFieldBlur={markFieldTouched}
                  onUpdate={updateInput}
                />
                <ActivationGroupPanel
                  actionResultById={actionResultById}
                  actions={policyActions}
                  emptyMessage="No policy route actions are needed for this draft."
                  listTitle="The following policy routes will be created:"
                />
              </div>
            ) : null}

            {currentStepId === "finalization" ? (
              <ActivationFinalizationPanel />
            ) : null}
          </div>
        </div>

        <ActivationNavigation
          currentStepIndex={currentStepIndex}
          action={getActivationNavigationAction({
            busy,
            contractBatchSupported: activationCapabilities.contractBatchSupported,
            currentStepId,
            finalizationAction,
            finalizationBlocked: bootstrapAdminActionsBlocked,
            progressByGroup,
            run: {
              bodies: executeCreateBodyGroup,
              mandates: executeAssignMandateGroup,
              policies: executeSetPolicyRuleGroup,
              roles: executeCreateRoleGroup,
            },
          })}
          stepState={stepStateById[currentStepId]}
          onBack={goBack}
          onNext={goNext}
        />
      </section>
    </section>
  );
}

function getVisibleActivationFieldIssues({
  inputs,
  stepId,
  touchedFields,
}: {
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly stepId: "holders" | "routes";
  readonly touchedFields: SetupWizardTouchedFields;
}): SetupWizardFieldIssueMap {
  return toFieldIssueMap(
    validateSetupWizardStep(stepId, inputs).filter((issue) =>
      Boolean(touchedFields[issue.fieldId]),
    ),
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
  const items: IsoStepItem[] = steps.map((step) => {
    const stepState = stepStateById[step.id];
    const locked = stepState.locked;
    return {
      description: locked ? stepState.reason : step.summary,
      disabled: locked,
      id: step.id,
      status:
        step.id === currentStepId
          ? "current"
          : locked
            ? "locked"
            : stepState.complete
              ? "complete"
              : "pending",
      title: step.title,
    };
  });

  return (
    <IsoSteps
      ariaLabel="Activation wizard steps"
      className="setup-wizard-steps"
      currentStepId={currentStepId}
      items={items}
      onStepSelect={(stepId) => onStepSelect(stepId as ActivationStepId)}
    />
  );
}

function ActivationGroupPanel({
  actionResultById,
  actions,
  emptyMessage,
  listTitle,
  purpose,
}: {
  readonly actionResultById: ReadonlyMap<
    string,
    SetupCompletionActionVerification
  >;
  readonly actions: readonly SetupAction[];
  readonly emptyMessage?: string;
  readonly listTitle: string;
  readonly purpose?: string;
}): JSX.Element {
  return (
    <section className="activation-group-panel">
      {purpose ? <p className="activation-group-purpose">{purpose}</p> : null}
      <ActivationActionPlanList
        actionResultById={actionResultById}
        actions={actions}
        emptyMessage={emptyMessage}
        listTitle={listTitle}
      />
    </section>
  );
}

function ActivationActionPlanList({
  actionResultById,
  actions,
  emptyMessage,
  listTitle,
}: {
  readonly actionResultById: ReadonlyMap<
    string,
    SetupCompletionActionVerification
  >;
  readonly actions: readonly SetupAction[];
  readonly emptyMessage?: string;
  readonly listTitle: string;
}): JSX.Element {
  if (actions.length === 0) {
    return emptyMessage ? (
      <div className="setup-action-empty">{emptyMessage}</div>
    ) : (
      <></>
    );
  }

  return (
    <div className="activation-action-plan-list">
      <h4>{listTitle}</h4>
      <ol>
        {actions.map((action) => (
          <li key={action.actionId}>
            <strong>
              {formatActionPlanTitle(
                action,
                actionResultById.get(action.actionId),
              )}
            </strong>
            <span>{getActionPlanDescription(action)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatActionPlanTitle(
  action: SetupAction,
  result?: SetupCompletionActionVerification,
): string {
  const title = action.label.replace(/^(Create|Assign|Set)\s+/i, "");
  if (!result?.indexedEntityId) {
    return title;
  }

  return `${title} (${getIndexedEntityLabel(action.kind, result.indexedEntityId)})`;
}

function getIndexedEntityLabel(kind: SetupActionKind, indexedEntityId: string): string {
  switch (kind) {
    case SetupActionKind.CreateOrganization:
      return `Organization #${indexedEntityId}`;
    case SetupActionKind.CreateBody:
      return `Body #${indexedEntityId}`;
    case SetupActionKind.CreateRole:
      return `Role #${indexedEntityId}`;
    case SetupActionKind.AssignMandate:
      return `Mandate #${indexedEntityId}`;
    case SetupActionKind.SetPolicyRule:
      return `Policy version ${indexedEntityId}`;
  }
}

function getActionPlanDescription(action: SetupAction): string {
  if (action.description) {
    return action.description;
  }

  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return "Creates the organization root.";
    case SetupActionKind.CreateBody:
      return "Creates an active governance body for this organization.";
    case SetupActionKind.CreateRole:
      return "Creates a scoped authority role inside an indexed governance body.";
    case SetupActionKind.AssignMandate:
      return "Assigns a holder wallet to this role scope.";
    case SetupActionKind.SetPolicyRule:
      return "Sets approval, veto, executor, and timelock constraints for this proposal route.";
  }
}

function ActivationFinalizationPanel(): JSX.Element {
  return (
    <section className="activation-finalization-panel">
      <div>
        <h3>Organization activation is ready</h3>
        <p>
          The required setup read models are indexed. Activate the organization
          to close bootstrap setup authority and continue from the Governance
          Structure page.
        </p>
      </div>
    </section>
  );
}

function ActivationNavigation({
  action,
  currentStepIndex,
  onBack,
  onNext,
  stepState,
}: {
  readonly action?: ActivationNavigationAction;
  readonly currentStepIndex: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly stepState: ActivationStepState;
}): JSX.Element {
  const lastStep = currentStepIndex >= ACTIVATION_STEPS.length - 1;
  const canGoNext = !lastStep && stepState.complete;
  const primaryAction = action ?? (
    !lastStep
      ? {
          disabled: !canGoNext,
          icon: "arrow-right" as const,
          iconPosition: "end" as const,
          label: "Next",
          onClick: onNext,
        }
      : undefined
  );

  return (
    <footer
      className={[
        "setup-wizard-navigation",
        "activation-navigation",
        currentStepIndex === 0 ? "setup-wizard-navigation-first" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {currentStepIndex > 0 ? (
        <button className="button" type="button" onClick={onBack}>
          <IsoIcon name="arrow-left" size={16} />
          <span>Back</span>
        </button>
      ) : null}
      {primaryAction ? (
        <button
          className="button button-primary"
          disabled={primaryAction.disabled}
          title={primaryAction.title}
          type="button"
          onClick={primaryAction.onClick}
        >
          {primaryAction.iconPosition !== "end" ? (
            <IsoIcon name={primaryAction.icon} size={16} />
          ) : null}
          <span>{primaryAction.label}</span>
          {primaryAction.iconPosition === "end" ? (
            <IsoIcon name={primaryAction.icon} size={16} />
          ) : null}
        </button>
      ) : null}
    </footer>
  );
}

interface ActivationNavigationAction {
  readonly disabled?: boolean;
  readonly icon: "arrow-right" | "startup";
  readonly iconPosition?: "start" | "end";
  readonly label: string;
  readonly onClick: () => void;
  readonly title?: string;
}

function getActivationNavigationAction({
  busy,
  contractBatchSupported,
  currentStepId,
  finalizationAction,
  finalizationBlocked,
  progressByGroup,
  run,
}: {
  readonly busy: boolean;
  readonly contractBatchSupported: boolean;
  readonly currentStepId: ActivationStepId;
  readonly finalizationAction: OrganizationFinalizationAction;
  readonly finalizationBlocked: boolean;
  readonly progressByGroup: Readonly<Record<ActivationGroupId, ActivationGroupProgress>>;
  readonly run: Readonly<Record<ActivationGroupId, () => Promise<void>>>;
}): ActivationNavigationAction | undefined {
  if (currentStepId === "finalization") {
    if (finalizationBlocked) {
      return undefined;
    }

    return {
      disabled: busy || finalizationAction.busy,
      icon: "startup",
      iconPosition: "start",
      label: "Activate Organization",
      onClick: () => {
        void finalizationAction.run();
      },
      title:
        busy || finalizationAction.busy
          ? "A setup transaction is already active."
          : undefined,
    };
  }

  if (!isActivationGroupStepId(currentStepId)) {
    return undefined;
  }

  const progress = progressByGroup[currentStepId];
  if (progress.complete) {
    return undefined;
  }

  const disabledReason =
    finalizationBlocked
      ? "This organization is finalized. Bootstrap admin changes are no longer available."
      : !contractBatchSupported
        ? "Contract batch activation is unavailable for this environment."
        : getGroupRunDisabledReason({ busy, progress });

  return {
    disabled: Boolean(disabledReason),
    icon: "startup",
    iconPosition: "start",
    label: getActivationGroupPrimaryLabel(currentStepId),
    onClick: () => {
      void run[currentStepId]();
    },
    title: disabledReason,
  };
}

function isActivationGroupStepId(
  stepId: ActivationStepId,
): stepId is ActivationGroupId {
  return (
    stepId === "bodies" ||
    stepId === "roles" ||
    stepId === "mandates" ||
    stepId === "policies"
  );
}

function getActivationGroupPrimaryLabel(stepId: ActivationGroupId): string {
  switch (stepId) {
    case "bodies":
      return "Create Bodies";
    case "roles":
      return "Create Roles";
    case "mandates":
      return "Assign Mandates";
    case "policies":
      return "Create Policy Routes";
  }
}

function buildActivationStepStateById({
  finalized,
  progress,
}: {
  readonly finalized: boolean;
  readonly progress: Readonly<Record<ActivationGroupId, ActivationGroupProgress>>;
}): Readonly<Record<ActivationStepId, ActivationStepState>> {
  const activationComplete =
    progress.bodies.complete &&
    progress.roles.complete &&
    progress.mandates.complete &&
    progress.policies.complete;
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
    finalization: {
      complete: finalized,
      locked: !activationComplete && !finalized,
      reason: finalized
        ? "Organization activation is indexed."
        : activationComplete
          ? "Activate the organization to close bootstrap setup authority."
          : "Complete activation before finalization.",
    },
  };
}

function getGroupRunDisabledReason({
  busy,
  progress,
}: {
  readonly busy: boolean;
  readonly progress: ActivationGroupProgress;
}): string | undefined {
  if (busy) {
    return "A setup transaction is already active. Wait for it to complete or fail before starting another run.";
  }

  if (!progress.canRun) {
    return progress.disabledReason;
  }

  return undefined;
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
