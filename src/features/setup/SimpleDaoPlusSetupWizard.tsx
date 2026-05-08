import type {
  SetupDraft,
  SetupValidationWarning,
  TemplateDescriptor,
} from "@isonia/types";
import { SetupActionKind, SetupValidationWarningCode } from "@isonia/types";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { buildOrganizationSlug, normalizeOrganizationSlug } from "../../chain/setup-contracts";
import { formatLabel } from "../../utils/format";
import type { SimpleDaoPlusDraftInputs } from "./setup-templates";
import { SIMPLE_DAO_PLUS_TEMPLATE_ID } from "./setup-templates";
import {
  getStepFieldIds,
  toFieldIssueMap,
  validateSetupWizardStep,
  type SetupWizardFieldId,
  type SetupWizardStepId,
  type SetupWizardTouchedFields,
} from "./setup-wizard-validation";
import { SetupDraftPreview } from "./SetupDraftPreview";
import {
  GovernanceBodiesStep,
  HoldersStep,
  IdentityStep,
  PolicyRoutesStep,
  TemplateStep,
} from "./SimpleDaoPlusSetupWizardSteps";

interface SetupWizardStep {
  readonly id: SetupWizardStepId;
  readonly title: string;
  readonly summary: string;
}

const WIZARD_STEPS: readonly SetupWizardStep[] = [
  {
    id: "template",
    summary: "Pick the setup shape available in v0.6.",
    title: "Choose template",
  },
  {
    id: "bodies",
    summary: "Preview the fixed Simple DAO+ governance structure.",
    title: "Governance structure",
  },
  {
    id: "identity",
    summary: "Name the organization and set initial admin authority.",
    title: "Organization identity",
  },
  {
    id: "holders",
    summary: "Add eligible holders for council and executor mandates.",
    title: "Members and holders",
  },
  {
    id: "routes",
    summary: "Tune executor routing and timelocks.",
    title: "Policy routes",
  },
  {
    id: "review",
    summary: "Validate setup and execute when ready.",
    title: "Review setup draft",
  },
];

interface SimpleDaoPlusSetupWizardProps {
  readonly disabled?: boolean;
  readonly draft: SetupDraft;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onChange: (inputs: SimpleDaoPlusDraftInputs) => void;
  readonly reviewSupplement?: ReactNode;
  readonly selectedTemplateId?: string;
  readonly templates: readonly TemplateDescriptor[];
}

export function SimpleDaoPlusSetupWizard({
  disabled = false,
  draft,
  inputs,
  onChange,
  reviewSupplement,
  selectedTemplateId = SIMPLE_DAO_PLUS_TEMPLATE_ID,
  templates,
}: SimpleDaoPlusSetupWizardProps): JSX.Element {
  const [currentStepId, setCurrentStepId] =
    useState<SetupWizardStepId>("template");
  const [highestUnlockedStepIndex, setHighestUnlockedStepIndex] = useState(0);
  const [attemptedStepIds, setAttemptedStepIds] = useState<
    ReadonlySet<SetupWizardStepId>
  >(new Set());
  const [touchedFields, setTouchedFields] =
    useState<SetupWizardTouchedFields>({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    inputs.organizationSlug.trim().length > 0,
  );
  const currentStepIndex = WIZARD_STEPS.findIndex(
    (step) => step.id === currentStepId,
  );
  const currentStep = WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0];
  const stepIssues = useMemo(
    () => groupValidationWarningsByStep(draft),
    [draft],
  );
  const currentStepFieldIssues = useMemo(
    () => validateSetupWizardStep(currentStep.id, inputs),
    [currentStep.id, inputs],
  );
  const visibleFieldIssues = useMemo(
    () =>
      toFieldIssueMap(
        currentStepFieldIssues.filter(
          (issue) =>
            Boolean(touchedFields[issue.fieldId]) ||
            attemptedStepIds.has(currentStep.id),
        ),
      ),
    [attemptedStepIds, currentStep.id, currentStepFieldIssues, touchedFields],
  );

  function update<Key extends keyof SimpleDaoPlusDraftInputs>(
    key: Key,
    value: SimpleDaoPlusDraftInputs[Key],
  ): void {
    if (key === "organizationName") {
      const organizationName = String(value);
      onChange({
        ...inputs,
        organizationName,
        organizationSlug: slugManuallyEdited
          ? inputs.organizationSlug
          : buildDraftSlugFromName(organizationName),
      });
      return;
    }

    if (key === "organizationSlug") {
      const organizationSlug = String(value);
      const manual = organizationSlug.trim().length > 0;
      setSlugManuallyEdited(manual);
      onChange({
        ...inputs,
        organizationSlug: manual
          ? normalizeOrganizationSlug(organizationSlug)
          : buildDraftSlugFromName(inputs.organizationName),
      });
      return;
    }

    onChange({ ...inputs, [key]: value });
  }

  function goToStep(stepId: SetupWizardStepId): void {
    const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === stepId);
    if (stepIndex > highestUnlockedStepIndex) {
      return;
    }
    setCurrentStepId(stepId);
  }

  function markFieldTouched(fieldId: SetupWizardFieldId): void {
    setTouchedFields((current) => ({ ...current, [fieldId]: true }));
  }

  function markStepAttempted(stepId: SetupWizardStepId): void {
    setAttemptedStepIds((current) => new Set(current).add(stepId));
    setTouchedFields((current) => {
      const next = { ...current };
      for (const fieldId of getStepFieldIds(stepId)) {
        next[fieldId] = true;
      }
      return next;
    });
  }

  function goBack(): void {
    const previousStep = WIZARD_STEPS[currentStepIndex - 1];
    if (previousStep) {
      setCurrentStepId(previousStep.id);
    }
  }

  function goNext(): void {
    const issues = validateSetupWizardStep(currentStep.id, inputs);
    if (issues.some((issue) => issue.severity === "error")) {
      markStepAttempted(currentStep.id);
      return;
    }

    const nextStep = WIZARD_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setHighestUnlockedStepIndex((current) =>
        Math.max(current, currentStepIndex + 1),
      );
      setCurrentStepId(nextStep.id);
    }
  }

  return (
    <section className="setup-wizard">
      <section className="panel setup-wizard-panel">
        <div className="panel-header">
          <div>
            <h2>Simple DAO+ Setup Wizard</h2>
            <p className="panel-subtitle">
              Guided setup for the organization root, governing bodies,
              holders, and policy routes.
            </p>
          </div>
        </div>

        <div className="setup-wizard-layout">
          <WizardStepList
            currentStepId={currentStepId}
            highestUnlockedStepIndex={highestUnlockedStepIndex}
            steps={WIZARD_STEPS}
            onStepSelect={goToStep}
          />

          <div className="setup-wizard-main">
            <div className="setup-wizard-step-heading">
              <span className="eyebrow">Step {currentStepIndex + 1}</span>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.summary}</p>
            </div>

            {currentStepId === "template" ? (
              <TemplateStep
                selectedTemplateId={selectedTemplateId}
                templates={templates}
              />
            ) : null}
            {currentStepId === "identity" ? (
              <IdentityStep
                disabled={disabled}
                fieldIssues={visibleFieldIssues}
                inputs={inputs}
                slugManuallyEdited={slugManuallyEdited}
                onFieldBlur={markFieldTouched}
                onResetSlug={() => {
                  setSlugManuallyEdited(false);
                  onChange({
                    ...inputs,
                    organizationSlug: buildDraftSlugFromName(inputs.organizationName),
                  });
                }}
                onUpdate={update}
              />
            ) : null}
            {currentStepId === "bodies" ? <GovernanceBodiesStep /> : null}
            {currentStepId === "holders" ? (
              <HoldersStep
                disabled={disabled}
                fieldIssues={visibleFieldIssues}
                inputs={inputs}
                onFieldBlur={markFieldTouched}
                onUpdate={update}
              />
            ) : null}
            {currentStepId === "routes" ? (
              <PolicyRoutesStep
                disabled={disabled}
                fieldIssues={visibleFieldIssues}
                inputs={inputs}
                onFieldBlur={markFieldTouched}
                onUpdate={update}
              />
            ) : null}
            {currentStepId === "review" ? (
              <ReviewStep
                draft={draft}
                reviewSupplement={reviewSupplement}
                stepIssues={stepIssues}
                onFixStep={goToStep}
              />
            ) : null}

            <WizardNavigation
              currentStepIndex={currentStepIndex}
              steps={WIZARD_STEPS}
              onBack={goBack}
              onNext={goNext}
            />
          </div>
        </div>
      </section>
    </section>
  );
}

function WizardStepList({
  currentStepId,
  highestUnlockedStepIndex,
  onStepSelect,
  steps,
}: {
  readonly currentStepId: SetupWizardStepId;
  readonly highestUnlockedStepIndex: number;
  readonly onStepSelect: (stepId: SetupWizardStepId) => void;
  readonly steps: readonly SetupWizardStep[];
}): JSX.Element {
  return (
    <nav aria-label="Setup wizard steps" className="setup-wizard-steps">
      <ol>
        {steps.map((step, index) => {
          const current = step.id === currentStepId;
          const locked = index > highestUnlockedStepIndex;
          return (
            <li key={step.id}>
              <button
                aria-current={current ? "step" : undefined}
                aria-disabled={locked}
                className={`setup-wizard-step-button${
                  current ? " setup-wizard-step-button-current" : ""
                }${locked ? " setup-wizard-step-button-locked" : ""}`}
                disabled={locked}
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

function WizardNavigation({
  currentStepIndex,
  onBack,
  onNext,
  steps,
}: {
  readonly currentStepIndex: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly steps: readonly SetupWizardStep[];
}): JSX.Element {
  const lastStep = currentStepIndex >= steps.length - 1;
  const nextStep = steps[currentStepIndex + 1];

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
        {nextStep?.id === "review" ? "Review execution" : "Next"}
      </button>
    </footer>
  );
}

type WizardStepIssueMap = Readonly<Record<SetupWizardStepId, readonly SetupValidationWarning[]>>;

function ReviewStep({
  draft,
  onFixStep,
  reviewSupplement,
  stepIssues,
}: {
  readonly draft: SetupDraft;
  readonly onFixStep: (stepId: SetupWizardStepId) => void;
  readonly reviewSupplement?: ReactNode;
  readonly stepIssues: WizardStepIssueMap;
}): JSX.Element {
  const issueSteps = WIZARD_STEPS.filter(
    (step) => (stepIssues[step.id]?.length ?? 0) > 0,
  );
  const totalErrors = draft.warnings.filter(
    (warning) => warning.severity === "error",
  ).length;

  return (
    <div className="setup-wizard-review">
      <div className="inline-state inline-state-muted setup-wizard-note">
        <strong>Review setup notes before execution</strong>
        <span>
          Review grouped issues, then use the execution panel in this final
          step. Technical action details stay collapsed until needed.
        </span>
      </div>

      <ReviewValidationPanel
        issueSteps={issueSteps}
        stepIssues={stepIssues}
        totalErrors={totalErrors}
        onFixStep={onFixStep}
      />

      {reviewSupplement}

      <details className="setup-technical-disclosure">
        <summary>Technical details</summary>
        <SetupDraftPreview draft={draft} />
      </details>
    </div>
  );
}

function ReviewValidationPanel({
  issueSteps,
  onFixStep,
  stepIssues,
  totalErrors,
}: {
  readonly issueSteps: readonly SetupWizardStep[];
  readonly onFixStep: (stepId: SetupWizardStepId) => void;
  readonly stepIssues: WizardStepIssueMap;
  readonly totalErrors: number;
}): JSX.Element {
  if (issueSteps.length === 0) {
    return (
      <div className="inline-state inline-state-success setup-wizard-note">
        <strong>Draft ready for execution</strong>
        <span>No blocking validation issues were found in this draft.</span>
      </div>
    );
  }

  return (
    <section
      className={`setup-review-validation ${
        totalErrors > 0
          ? "setup-review-validation-error"
          : "setup-review-validation-warning"
      }`}
    >
      <div className="setup-review-validation-header">
        <div>
          <strong>
            {totalErrors > 0
              ? "Resolve setup issues before execution"
              : "Setup notes before execution"}
          </strong>
          <span>
            {issueSteps.length} {pluralize("step", issueSteps.length)}{" "}
            {issueSteps.length === 1 ? "needs" : "need"} attention.{" "}
            {totalErrors > 0
              ? "Execution remains blocked while error-level issues exist."
              : "These notes do not block execution, but should be reviewed."}
          </span>
        </div>
      </div>

      <div className="setup-review-validation-list">
        {issueSteps.map((step) => {
          const issues = stepIssues[step.id] ?? [];
          return (
            <article className="setup-review-validation-row" key={step.id}>
              <div>
                <strong>{step.title}</strong>
                <span>{formatIssueCounts(issues)}</span>
                <small>{issues[0]?.message}</small>
              </div>
              <button
                className="button button-small"
                type="button"
                onClick={() => onFixStep(step.id)}
              >
                Fix
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function groupValidationWarningsByStep(draft: SetupDraft): WizardStepIssueMap {
  const groups: Record<SetupWizardStepId, SetupValidationWarning[]> = {
    bodies: [],
    holders: [],
    identity: [],
    review: [],
    routes: [],
    template: [],
  };

  for (const warning of draft.warnings) {
    groups[getValidationWarningStep(warning, draft)].push(warning);
  }

  return groups;
}

function getValidationWarningStep(
  warning: SetupValidationWarning,
  draft: SetupDraft,
): SetupWizardStepId {
  const action = draft.actions.find(
    (candidate) => candidate.actionId === warning.actionId,
  );

  if (warning.code === SetupValidationWarningCode.InvalidTimelock) {
    return "routes";
  }

  if (!action) {
    return "review";
  }

  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return "identity";
    case SetupActionKind.CreateBody:
      return isHolderWarning(warning) ? "holders" : "bodies";
    case SetupActionKind.CreateRole:
    case SetupActionKind.AssignMandate:
      return "holders";
    case SetupActionKind.SetPolicyRule:
      return isRouteShapeWarning(warning) ? "routes" : "holders";
  }
}

function isHolderWarning(warning: SetupValidationWarning): boolean {
  return (
    warning.code === SetupValidationWarningCode.MissingApproverMandate ||
    warning.code === SetupValidationWarningCode.MissingExecutorMandate ||
    warning.code === SetupValidationWarningCode.MissingVetoMandate ||
    warning.code === SetupValidationWarningCode.PolicyRouteWithoutEligibleHolder ||
    warning.code === SetupValidationWarningCode.ProposalTypeScopeMismatch ||
    /holder|mandate|eligible/i.test(warning.message)
  );
}

function isRouteShapeWarning(warning: SetupValidationWarning): boolean {
  return (
    warning.code === SetupValidationWarningCode.EmptyRequiredApprovals ||
    warning.code === SetupValidationWarningCode.InvalidTimelock ||
    /policy has no|timelock/i.test(warning.message)
  );
}

function formatIssueCounts(issues: readonly SetupValidationWarning[]): string {
  const counts = (["error", "warning", "info"] as const)
    .map((severity) => {
      const count = issues.filter((issue) => issue.severity === severity).length;
      return count > 0 ? `${count} ${formatLabel(pluralize(severity, count))}` : "";
    })
    .filter(Boolean);

  return counts.length > 0 ? counts.join(", ") : "No issues";
}

function pluralize(value: string, count: number): string {
  return count === 1 ? value : `${value}s`;
}

function buildDraftSlugFromName(organizationName: string): string {
  const trimmed = organizationName.trim();
  return trimmed.length > 0 ? buildOrganizationSlug(trimmed) : "";
}
