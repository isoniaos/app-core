import type { TemplateDescriptor } from "@isonia/types";
import { AddressInput, MultiAddressInput } from "../../ui/address";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatNumericString } from "../../utils/format";
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
  inputs,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onUpdate: SimpleDaoPlusInputUpdate;
}): JSX.Element {
  return (
    <div className="form-grid setup-wizard-form-grid">
      <label className="form-field">
        <span>Organization name</span>
        <input
          autoComplete="organization"
          disabled={disabled}
          placeholder="Acme Governance"
          type="text"
          value={inputs.organizationName}
          onChange={(event) =>
            onUpdate("organizationName", event.target.value)
          }
        />
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
        label="Organization admin address"
        normalizeOnBlur
        required
        value={inputs.organizationAdminAddress}
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
  inputs,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onUpdate: SimpleDaoPlusInputUpdate;
}): JSX.Element {
  return (
    <div className="form-grid setup-wizard-form-grid">
      <AddressListField
        disabled={disabled}
        label="General Council holders"
        value={inputs.generalCouncilHolderAddresses}
        onChange={(value) => onUpdate("generalCouncilHolderAddresses", value)}
      />
      <AddressListField
        disabled={disabled}
        label="Treasury Committee holders"
        value={inputs.treasuryCommitteeHolderAddresses}
        onChange={(value) =>
          onUpdate("treasuryCommitteeHolderAddresses", value)
        }
      />
      <AddressListField
        disabled={disabled}
        label="Security Council holders"
        value={inputs.securityCouncilHolderAddresses}
        onChange={(value) => onUpdate("securityCouncilHolderAddresses", value)}
      />
      <AddressInput
        className="form-field-wide"
        disabled={disabled}
        label="Executor holder address"
        normalizeOnBlur
        required
        value={inputs.executorHolderAddress}
        onChange={(value) => onUpdate("executorHolderAddress", value)}
      />
    </div>
  );
}

export function PolicyRoutesStep({
  disabled,
  inputs,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onUpdate: SimpleDaoPlusInputUpdate;
}): JSX.Element {
  return (
    <div className="setup-wizard-step-body">
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
          label="Standard timelock"
          value={inputs.standardTimelockSeconds}
          onChange={(value) => onUpdate("standardTimelockSeconds", value)}
        />
        <TimelockField
          disabled={disabled}
          label="Treasury timelock"
          value={inputs.treasuryTimelockSeconds}
          onChange={(value) => onUpdate("treasuryTimelockSeconds", value)}
        />
        <TimelockField
          disabled={disabled}
          label="Upgrade timelock"
          value={inputs.upgradeTimelockSeconds}
          onChange={(value) => onUpdate("upgradeTimelockSeconds", value)}
        />
        <TimelockField
          disabled={disabled}
          label="Emergency timelock"
          value={inputs.emergencyTimelockSeconds}
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
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: readonly string[]) => void;
  readonly value: readonly string[];
}): JSX.Element {
  return (
    <MultiAddressInput
      className="form-field-wide"
      disabled={disabled}
      label={label}
      normalizeOutput={false}
      placeholder="Paste or type addresses"
      required
      value={value}
      onChange={onChange}
    />
  );
}

function TimelockField({
  disabled,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        disabled={disabled}
        inputMode="numeric"
        min="0"
        step="1"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
      timelockSeconds: inputs.standardTimelockSeconds,
      vetoBody: "Security Council",
    },
    {
      approvalBodies: "General Council and Treasury Committee",
      executorBody: "Treasury Committee",
      name: "Treasury route",
      timelockSeconds: inputs.treasuryTimelockSeconds,
      vetoBody: "Security Council",
    },
    {
      approvalBodies: "General Council",
      executorBody: standardExecutor,
      name: "Upgrade route",
      timelockSeconds: inputs.upgradeTimelockSeconds,
      vetoBody: "Security Council",
    },
    {
      approvalBodies: "Security Council",
      executorBody: "Security Council",
      name: "Emergency route",
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
    readonly executorBody: string;
    readonly name: string;
    readonly timelockSeconds: string;
    readonly vetoBody: string;
  };
}): JSX.Element {
  return (
    <article className="setup-wizard-route-preview">
      <h4>{route.name}</h4>
      <dl className="detail-list">
        <div>
          <dt>Approval</dt>
          <dd>{route.approvalBodies}</dd>
        </div>
        <div>
          <dt>Veto</dt>
          <dd>{route.vetoBody}</dd>
        </div>
        <div>
          <dt>Executor</dt>
          <dd>{route.executorBody}</dd>
        </div>
        <div>
          <dt>Timelock</dt>
          <dd>{formatTimelock(route.timelockSeconds)}</dd>
        </div>
      </dl>
    </article>
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
  if (!trimmed) {
    return "Not set";
  }

  return `${formatNumericString(trimmed)} seconds`;
}
