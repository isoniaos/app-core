import type { TemplateDescriptor } from "@isonia/types";
import { AddressInput, MultiAddressInput } from "../../ui/address";
import { StatusBadge } from "../../ui/StatusBadge";
import { IsoIcon, IsoToggleTip } from "../../ui-kit";
import { formatNumericString } from "../../utils/format";
import { RoutePreviewCard } from "./RoutePreviewCard";
import type {
  SetupWizardFieldId,
  SetupWizardFieldIssue,
  SetupWizardFieldIssueMap,
} from "./setup-wizard-validation";
import type {
  SimpleDaoPlusDraftInputs,
  SimpleDaoPlusExecutorBodyChoice,
} from "./setup-templates";
import { SIMPLE_DAO_PLUS_TEMPLATE_ID } from "./setup-templates";

export type SimpleDaoPlusInputUpdate = <
  Key extends keyof SimpleDaoPlusDraftInputs,
>(
  key: Key,
  value: SimpleDaoPlusDraftInputs[Key],
) => void;

export interface SetupWizardFieldProps {
  readonly fieldIssues: SetupWizardFieldIssueMap;
  readonly onFieldBlur: (fieldId: SetupWizardFieldId) => void;
}

export function TemplateStep({
  selectedTemplateId,
  templates,
}: {
  readonly selectedTemplateId: string;
  readonly templates: readonly TemplateDescriptor[];
}): JSX.Element {
  return (
    <div className="setup-wizard-step-body">
      <div className="template-grid setup-wizard-template-grid">
        {templates.map((template) => {
          const available = template.templateId === SIMPLE_DAO_PLUS_TEMPLATE_ID;
          const selected = template.templateId === selectedTemplateId;

          return (
            <article
              aria-current={selected ? "true" : undefined}
              aria-disabled={!available}
              className={[
                "template-card",
                selected ? "template-card-selected" : "",
                !available ? "setup-wizard-template-disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={template.templateId}
            >
              <div className="entity-card-header">
                <div>
                  <h3>{template.name}</h3>
                  <p>{template.summary}</p>
                </div>
                <StatusBadge tone={available ? "success" : "muted"}>
                  {selected ? "Active" : available ? "Available" : "Planned"}
                </StatusBadge>
              </div>
              {template.description ? <p>{template.description}</p> : null}
            </article>
          );
        })}
      </div>

      <div className="inline-state inline-state-muted setup-wizard-note">
        <strong>v0.6 alpha template availability</strong>
        <span>
          Simple DAO+ is the only usable setup template in this milestone.
          Planned templates are shown for orientation and are not implemented.
        </span>
      </div>
    </div>
  );
}

export function IdentityStep({
  disabled,
  fieldIssues,
  inputs,
  slugManuallyEdited,
  onFieldBlur,
  onResetSlug,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly fieldIssues: SetupWizardFieldIssueMap;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly slugManuallyEdited: boolean;
  readonly onFieldBlur: (fieldId: SetupWizardFieldId) => void;
  readonly onResetSlug: () => void;
  readonly onUpdate: SimpleDaoPlusInputUpdate;
}): JSX.Element {
  const nameIssue = fieldIssues.organizationName;
  const slugIssue = fieldIssues.organizationSlug;

  return (
    <div className="form-grid setup-wizard-form-grid">
      <label className={getFormFieldClassName(nameIssue)}>
        <span>
          Organization name
          <RequiredMarker />
        </span>
        <input
          aria-invalid={nameIssue?.severity === "error" ? true : undefined}
          autoComplete="organization"
          disabled={disabled}
          placeholder="Acme Governance"
          type="text"
          value={inputs.organizationName}
          onBlur={() => onFieldBlur("organizationName")}
          onChange={(event) =>
            onUpdate("organizationName", event.target.value)
          }
        />
        <FieldIssueText issue={nameIssue} />
      </label>

      <label className={getFormFieldClassName(slugIssue)}>
        <span className="form-field-label-row">
          <span>
            Organization slug
            <RequiredMarker />
          </span>
          <IsoToggleTip
            content="The slug is the URL-safe organization identifier App Core uses in setup drafts and indexed organization lists. It should be short, stable, and recognizable."
            title="Organization slug"
          >
            <button
              aria-label="Explain organization slug"
              className="field-help-button"
              type="button"
            >
              <IsoIcon name="question" size={15} />
            </button>
          </IsoToggleTip>
        </span>
        <div className="setup-slug-control">
          <input
            aria-invalid={slugIssue?.severity === "error" ? true : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder="acme-governance"
            spellCheck={false}
            type="text"
            value={inputs.organizationSlug}
            onBlur={() => onFieldBlur("organizationSlug")}
            onChange={(event) =>
              onUpdate("organizationSlug", event.target.value)
            }
          />
          {slugManuallyEdited ? (
            <button
              className="button button-small"
              disabled={disabled}
              type="button"
              onClick={onResetSlug}
            >
              Reset
            </button>
          ) : null}
        </div>
        <FieldIssueText issue={slugIssue} />
      </label>

      <label className="form-field">
        <span>Organization metadata URI</span>
        <input
          autoComplete="off"
          disabled={disabled}
          placeholder="ipfs://organization-metadata"
          type="text"
          value={inputs.organizationMetadataUri}
          onChange={(event) =>
            onUpdate("organizationMetadataUri", event.target.value)
          }
        />
      </label>

      <AddressInput
        className="form-field-wide"
        disabled={disabled}
        error={fieldIssues.organizationAdminAddress?.message}
        label="Organization admin address"
        normalizeOnBlur
        required
        showFeedback={Boolean(fieldIssues.organizationAdminAddress)}
        value={inputs.organizationAdminAddress}
        onBlur={() => onFieldBlur("organizationAdminAddress")}
        onChange={(value) => onUpdate("organizationAdminAddress", value)}
      />
    </div>
  );
}

export function GovernanceBodiesStep(): JSX.Element {
  return (
    <div className="setup-wizard-body-grid">
      <GovernanceBodyPreview
        name="General Council"
        purpose="Reviews standard governance, anchors broad approval, and receives body admin, proposer, and approver mandates."
      />
      <GovernanceBodyPreview
        name="Treasury Committee"
        purpose="Provides treasury-specific approval and the default executor body for standard, treasury, and upgrade routes."
      />
      <GovernanceBodyPreview
        name="Security Council"
        purpose="Provides veto coverage across routes and handles emergency approval and execution authority."
      />
    </div>
  );
}

export function HoldersStep({
  disabled,
  fieldIssues,
  inputs,
  onFieldBlur,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly fieldIssues: SetupWizardFieldIssueMap;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onFieldBlur: (fieldId: SetupWizardFieldId) => void;
  readonly onUpdate: SimpleDaoPlusInputUpdate;
}): JSX.Element {
  return (
    <div className="form-grid setup-wizard-form-grid">
      <AddressListField
        disabled={disabled}
        fieldId="generalCouncilHolderAddresses"
        issue={fieldIssues.generalCouncilHolderAddresses}
        label="General Council holders"
        value={inputs.generalCouncilHolderAddresses}
        onBlur={onFieldBlur}
        onChange={(value) => onUpdate("generalCouncilHolderAddresses", value)}
      />
      <AddressListField
        disabled={disabled}
        fieldId="treasuryCommitteeHolderAddresses"
        issue={fieldIssues.treasuryCommitteeHolderAddresses}
        label="Treasury Committee holders"
        value={inputs.treasuryCommitteeHolderAddresses}
        onBlur={onFieldBlur}
        onChange={(value) =>
          onUpdate("treasuryCommitteeHolderAddresses", value)
        }
      />
      <AddressListField
        disabled={disabled}
        fieldId="securityCouncilHolderAddresses"
        issue={fieldIssues.securityCouncilHolderAddresses}
        label="Security Council holders"
        value={inputs.securityCouncilHolderAddresses}
        onBlur={onFieldBlur}
        onChange={(value) => onUpdate("securityCouncilHolderAddresses", value)}
      />
      <AddressInput
        className="form-field-wide"
        disabled={disabled}
        error={fieldIssues.executorHolderAddress?.message}
        label="Executor holder address"
        normalizeOnBlur
        required
        showFeedback={Boolean(fieldIssues.executorHolderAddress)}
        value={inputs.executorHolderAddress}
        onBlur={() => onFieldBlur("executorHolderAddress")}
        onChange={(value) => onUpdate("executorHolderAddress", value)}
      />
    </div>
  );
}

export function PolicyRoutesStep({
  disabled,
  fieldIssues,
  inputs,
  onFieldBlur,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly fieldIssues: SetupWizardFieldIssueMap;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onFieldBlur: (fieldId: SetupWizardFieldId) => void;
  readonly onUpdate: SimpleDaoPlusInputUpdate;
}): JSX.Element {
  return (
    <div className="setup-wizard-step-body">
      <div className="setup-wizard-hint">
        <IsoIcon name="lightbulb" size={20} />
        <div>
          <strong>Emergency delay can be explicit and short</strong>
          <span>
            Emergency routes exist for narrow response authority. A zero-second
            delay can be useful in local demos, while production policies may
            require a different value.
          </span>
        </div>
      </div>

      <div className="form-grid setup-wizard-form-grid">
        <label className="form-field">
          <span>Standard and upgrade executor body</span>
          <select
            disabled={disabled}
            value={inputs.executorBodyChoice}
            onChange={(event) =>
              onUpdate(
                "executorBodyChoice",
                event.target.value as SimpleDaoPlusExecutorBodyChoice,
              )
            }
          >
            <option value="treasury_committee">Treasury Committee</option>
            <option value="general_council">General Council</option>
          </select>
        </label>

        <TimelockField
          disabled={disabled}
          fieldId="standardTimelockSeconds"
          issue={fieldIssues.standardTimelockSeconds}
          label="Standard delay in seconds"
          value={inputs.standardTimelockSeconds}
          onBlur={onFieldBlur}
          onChange={(value) => onUpdate("standardTimelockSeconds", value)}
        />
        <TimelockField
          disabled={disabled}
          fieldId="treasuryTimelockSeconds"
          issue={fieldIssues.treasuryTimelockSeconds}
          label="Treasury delay in seconds"
          value={inputs.treasuryTimelockSeconds}
          onBlur={onFieldBlur}
          onChange={(value) => onUpdate("treasuryTimelockSeconds", value)}
        />
        <TimelockField
          disabled={disabled}
          fieldId="upgradeTimelockSeconds"
          issue={fieldIssues.upgradeTimelockSeconds}
          label="Upgrade delay in seconds"
          value={inputs.upgradeTimelockSeconds}
          onBlur={onFieldBlur}
          onChange={(value) => onUpdate("upgradeTimelockSeconds", value)}
        />
        <TimelockField
          disabled={disabled}
          fieldId="emergencyTimelockSeconds"
          issue={fieldIssues.emergencyTimelockSeconds}
          label="Emergency delay in seconds"
          value={inputs.emergencyTimelockSeconds}
          onBlur={onFieldBlur}
          onChange={(value) => onUpdate("emergencyTimelockSeconds", value)}
        />
      </div>

      <PolicyRoutePreviewList inputs={inputs} />
    </div>
  );
}

export function ReviewStep(): JSX.Element {
  return (
    <div className="inline-state inline-state-muted setup-wizard-note">
      <strong>Review before any setup transaction</strong>
      <span>
        The draft remains browser-side and non-authoritative until the required
        contract transactions are signed, confirmed, indexed, and projected.
        The full action list and all validation warnings stay visible below.
      </span>
    </div>
  );
}

function GovernanceBodyPreview({
  name,
  purpose,
}: {
  readonly name: string;
  readonly purpose: string;
}): JSX.Element {
  return (
    <article className="setup-wizard-body-preview">
      <h4>{name}</h4>
      <p>{purpose}</p>
    </article>
  );
}

function AddressListField({
  disabled,
  fieldId,
  issue,
  label,
  onBlur,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly fieldId: SetupWizardFieldId;
  readonly issue?: SetupWizardFieldIssue;
  readonly label: string;
  readonly onBlur: (fieldId: SetupWizardFieldId) => void;
  readonly onChange: (value: readonly string[]) => void;
  readonly value: readonly string[];
}): JSX.Element {
  return (
    <MultiAddressInput
      className="form-field-wide"
      disabled={disabled}
      error={issue?.message}
      label={label}
      normalizeOutput={false}
      placeholder="Paste or type addresses"
      required
      showFeedback={Boolean(issue)}
      value={value}
      onBlur={() => onBlur(fieldId)}
      onChange={onChange}
    />
  );
}

function TimelockField({
  disabled,
  fieldId,
  issue,
  label,
  onBlur,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly fieldId: SetupWizardFieldId;
  readonly issue?: SetupWizardFieldIssue;
  readonly label: string;
  readonly onBlur: (fieldId: SetupWizardFieldId) => void;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <label className={getFormFieldClassName(issue)}>
      <span>
        {label}
        <RequiredMarker />
      </span>
      <input
        aria-invalid={issue?.severity === "error" ? true : undefined}
        disabled={disabled}
        inputMode="numeric"
        min="0"
        step="1"
        type="number"
        value={value}
        onBlur={() => onBlur(fieldId)}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldIssueText issue={issue} />
    </label>
  );
}

function PolicyRoutePreviewList({
  inputs,
}: {
  readonly inputs: SimpleDaoPlusDraftInputs;
}): JSX.Element {
  const standardExecutor = getStandardExecutorBodyLabel(
    inputs.executorBodyChoice,
  );
  const routes = [
    {
      approvalBodies: "General Council",
      executorBody: standardExecutor,
      name: "Standard route",
      description: "Default proposal route for standard governance changes.",
      timelockSeconds: inputs.standardTimelockSeconds,
      vetoBody: "Security Council",
    },
    {
      approvalBodies: "General Council and Treasury Committee",
      executorBody: "Treasury Committee",
      name: "Treasury route",
      description: "Treasury changes require general and treasury approval.",
      timelockSeconds: inputs.treasuryTimelockSeconds,
      vetoBody: "Security Council",
    },
    {
      approvalBodies: "General Council",
      executorBody: standardExecutor,
      name: "Upgrade route",
      description: "Protocol upgrade decisions use the standard approval path.",
      timelockSeconds: inputs.upgradeTimelockSeconds,
      vetoBody: "Security Council",
    },
    {
      approvalBodies: "Security Council",
      executorBody: "Security Council",
      name: "Emergency route",
      description: "Emergency authority is narrow and explicitly routed.",
      timelockSeconds: inputs.emergencyTimelockSeconds,
      vetoBody: "Security Council",
    },
  ] as const;

  return (
    <div className="setup-wizard-route-grid">
      {routes.map((route) => (
        <PolicyRoutePreview key={route.name} route={route} />
      ))}
    </div>
  );
}

function PolicyRoutePreview({
  route,
}: {
  readonly route: {
    readonly approvalBodies: string;
    readonly description: string;
    readonly executorBody: string;
    readonly name: string;
    readonly timelockSeconds: string;
    readonly vetoBody: string;
  };
}): JSX.Element {
  return (
    <RoutePreviewCard
      description={route.description}
      facts={[
        { icon: "check", label: "Approval", value: route.approvalBodies },
        { icon: "warning", label: "Veto", value: route.vetoBody },
        { icon: "info", label: "Executor", value: route.executorBody },
        {
          icon: "lightbulb",
          label: "Timelock",
          value: formatTimelock(route.timelockSeconds),
        },
      ]}
      title={route.name}
    />
  );
}

function getStandardExecutorBodyLabel(
  choice: SimpleDaoPlusExecutorBodyChoice,
): string {
  return choice === "general_council"
    ? "General Council"
    : "Treasury Committee";
}

function formatTimelock(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return "Not set";
  }

  const seconds = BigInt(trimmed);
  const hours = seconds / 3_600n;
  const minutes = (seconds % 3_600n) / 60n;
  const remainingSeconds = seconds % 60n;
  const duration = [hours, minutes, remainingSeconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");

  return `${duration} (${formatNumericString(trimmed)} seconds)`;
}

function RequiredMarker(): JSX.Element {
  return (
    <span aria-hidden="true" className="field-required-marker">
      *
    </span>
  );
}

function FieldIssueText({
  issue,
}: {
  readonly issue?: SetupWizardFieldIssue;
}): JSX.Element | null {
  if (!issue) {
    return null;
  }

  return (
    <small className={`setup-field-message setup-field-message-${issue.severity}`}>
      {issue.message}
    </small>
  );
}

function getFormFieldClassName(issue?: SetupWizardFieldIssue): string {
  return [
    "form-field",
    issue ? `form-field-${issue.severity}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}
