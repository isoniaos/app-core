import type { SetupDraft, TemplateDescriptor } from "@isonia/types";
import { SetupDraftStatus } from "@isonia/types";
import { useMemo, useState } from "react";
import { StatusBadge } from "../../ui/StatusBadge";
import type { SimpleDaoPlusDraftInputs } from "./setup-templates";
import { SIMPLE_DAO_PLUS_TEMPLATE_ID } from "./setup-templates";
import { SetupDraftPreview } from "./SetupDraftPreview";
import {
  GovernanceBodiesStep,
  HoldersStep,
  IdentityStep,
  PolicyRoutesStep,
  ReviewStep,
  TemplateStep,
} from "./SimpleDaoPlusSetupWizardSteps";
import {
  summarizeSetupValidationWarnings,
  type SetupValidationSummary,
} from "./setup-validation";

type SetupWizardStepId =
  | "template"
  | "identity"
  | "bodies"
  | "holders"
  | "routes"
  | "review";

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
    id: "identity",
    summary: "Name the organization and set initial admin authority.",
    title: "Organization identity",
  },
  {
    id: "bodies",
    summary: "Review the fixed Simple DAO+ governance bodies.",
    title: "Governance bodies",
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
    summary: "Inspect validation and low-level setup actions.",
    title: "Review setup draft",
  },
];

interface SimpleDaoPlusSetupWizardProps {
  readonly disabled?: boolean;
  readonly draft: SetupDraft;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onChange: (inputs: SimpleDaoPlusDraftInputs) => void;
  readonly selectedTemplateId?: string;
  readonly templates: readonly TemplateDescriptor[];
}

export function SimpleDaoPlusSetupWizard({
  disabled = false,
  draft,
  inputs,
  onChange,
  selectedTemplateId = SIMPLE_DAO_PLUS_TEMPLATE_ID,
  templates,
}: SimpleDaoPlusSetupWizardProps): JSX.Element {
  const [currentStepId, setCurrentStepId] =
    useState<SetupWizardStepId>("template");
  const currentStepIndex = WIZARD_STEPS.findIndex(
    (step) => step.id === currentStepId,
  );
  const currentStep = WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0];
  const validationSummary = useMemo(
    () => summarizeSetupValidationWarnings(draft.warnings),
    [draft.warnings],
  );

  function update<Key extends keyof SimpleDaoPlusDraftInputs>(
    key: Key,
    value: SimpleDaoPlusDraftInputs[Key],
  ): void {
    onChange({ ...inputs, [key]: value });
  }

  function goToStep(stepId: SetupWizardStepId): void {
    setCurrentStepId(stepId);
  }

  function goBack(): void {
    const previousStep = WIZARD_STEPS[currentStepIndex - 1];
    if (previousStep) {
      setCurrentStepId(previousStep.id);
    }
  }

  function goNext(): void {
    const nextStep = WIZARD_STEPS[currentStepIndex + 1];
    if (nextStep) {
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
              A guided shell over the same browser-side draft, validation,
              preview, and execution flow.
            </p>
          </div>
          <StatusBadge tone={validationSummary.blocked ? "danger" : "success"}>
            {validationSummary.blocked ? "Draft blocked" : "Draft reviewable"}
          </StatusBadge>
        </div>

        <div className="setup-wizard-layout">
          <WizardStepList
            currentStepId={currentStepId}
            steps={WIZARD_STEPS}
            onStepSelect={goToStep}
          />

          <div className="setup-wizard-main">
            <DraftValidationStrip
              draftStatus={draft.status}
              summary={validationSummary}
            />

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
                inputs={inputs}
                onUpdate={update}
              />
            ) : null}
            {currentStepId === "bodies" ? <GovernanceBodiesStep /> : null}
            {currentStepId === "holders" ? (
              <HoldersStep
                disabled={disabled}
                inputs={inputs}
                onUpdate={update}
              />
            ) : null}
            {currentStepId === "routes" ? (
              <PolicyRoutesStep
                disabled={disabled}
                inputs={inputs}
                onUpdate={update}
              />
            ) : null}
            {currentStepId === "review" ? <ReviewStep /> : null}

            <WizardNavigation
              currentStepIndex={currentStepIndex}
              steps={WIZARD_STEPS}
              onBack={goBack}
              onNext={goNext}
            />
          </div>
        </div>
      </section>

      {currentStepId === "review" ? <SetupDraftPreview draft={draft} /> : null}
    </section>
  );
}

function WizardStepList({
  currentStepId,
  onStepSelect,
  steps,
}: {
  readonly currentStepId: SetupWizardStepId;
  readonly onStepSelect: (stepId: SetupWizardStepId) => void;
  readonly steps: readonly SetupWizardStep[];
}): JSX.Element {
  return (
    <nav aria-label="Setup wizard steps" className="setup-wizard-steps">
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

function DraftValidationStrip({
  draftStatus,
  summary,
}: {
  readonly draftStatus: SetupDraftStatus;
  readonly summary: SetupValidationSummary;
}): JSX.Element {
  const blocked = summary.blocked || draftStatus === SetupDraftStatus.Blocked;

  return (
    <div
      className={`setup-validation-state ${
        blocked
          ? "setup-validation-state-danger"
          : "setup-validation-state-success"
      }`}
    >
      <div>
        <strong>
          {blocked ? "Draft blocked before execution" : "Draft ready for review"}
        </strong>
        <span>
          Navigation remains open so incomplete drafts can still be reviewed.
          Execution readiness comes from the setup validation warnings.
        </span>
      </div>
      <ul className="setup-wizard-validation-badges">
        <li>
          <StatusBadge tone={summary.errors > 0 ? "danger" : "muted"}>
            {summary.errors} errors
          </StatusBadge>
        </li>
        <li>
          <StatusBadge tone={summary.warnings > 0 ? "warning" : "muted"}>
            {summary.warnings} warnings
          </StatusBadge>
        </li>
        <li>
          <StatusBadge tone={summary.info > 0 ? "default" : "muted"}>
            {summary.info} info
          </StatusBadge>
        </li>
      </ul>
    </div>
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
    <div className="setup-wizard-navigation">
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
        {nextStep?.id === "review" ? "Review setup draft" : "Next"}
      </button>
    </div>
  );
}
