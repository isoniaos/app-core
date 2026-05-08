import { AddressInput, MultiAddressInput } from "../../ui/address";
import type {
  SimpleDaoPlusDraftInputs,
  SimpleDaoPlusExecutorBodyChoice,
} from "./setup-templates";

interface SimpleDaoPlusDraftFormProps {
  readonly disabled?: boolean;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly onChange: (inputs: SimpleDaoPlusDraftInputs) => void;
}

export function SimpleDaoPlusDraftForm({
  disabled = false,
  inputs,
  onChange,
}: SimpleDaoPlusDraftFormProps): JSX.Element {
  function update<Key extends keyof SimpleDaoPlusDraftInputs>(
    key: Key,
    value: SimpleDaoPlusDraftInputs[Key],
  ): void {
    onChange({ ...inputs, [key]: value });
  }

  return (
    <section className="panel setup-form-panel">
      <div className="panel-header">
        <div>
          <h2>Simple DAO+ Inputs</h2>
          <p className="panel-subtitle">
            These values only shape the browser draft. They do not create
            authority until explicit contract transactions are signed.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Organization name</span>
          <input
            autoComplete="organization"
            disabled={disabled}
            placeholder="Acme Governance"
            type="text"
            value={inputs.organizationName}
            onChange={(event) =>
              update("organizationName", event.target.value)
            }
          />
        </label>

        <label className="form-field">
          <span>
            Organization slug
            <span aria-hidden="true" className="field-required-marker">
              *
            </span>
          </span>
          <input
            autoComplete="off"
            disabled={disabled}
            placeholder="acme-governance"
            type="text"
            value={inputs.organizationSlug}
            onChange={(event) =>
              update("organizationSlug", event.target.value)
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
              update("organizationMetadataUri", event.target.value)
            }
          />
        </label>

        <AddressInput
          className="form-field-wide"
          disabled={disabled}
          label="Organization admin address"
          required
          value={inputs.organizationAdminAddress}
          onChange={(value) => update("organizationAdminAddress", value)}
        />

        <AddressListField
          disabled={disabled}
          label="General Council holder addresses"
          value={inputs.generalCouncilHolderAddresses}
          onChange={(value) => update("generalCouncilHolderAddresses", value)}
        />

        <AddressListField
          disabled={disabled}
          label="Treasury Committee holder addresses"
          value={inputs.treasuryCommitteeHolderAddresses}
          onChange={(value) =>
            update("treasuryCommitteeHolderAddresses", value)
          }
        />

        <AddressListField
          disabled={disabled}
          label="Security Council holder addresses"
          value={inputs.securityCouncilHolderAddresses}
          onChange={(value) => update("securityCouncilHolderAddresses", value)}
        />

        <AddressInput
          disabled={disabled}
          label="Executor holder address"
          required
          value={inputs.executorHolderAddress}
          onChange={(value) => update("executorHolderAddress", value)}
        />

        <label className="form-field">
          <span>Standard and upgrade executor body</span>
          <select
            disabled={disabled}
            value={inputs.executorBodyChoice}
            onChange={(event) =>
              update(
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
          label="Standard delay in seconds"
          value={inputs.standardTimelockSeconds}
          onChange={(value) => update("standardTimelockSeconds", value)}
        />

        <TimelockField
          disabled={disabled}
          label="Treasury delay in seconds"
          value={inputs.treasuryTimelockSeconds}
          onChange={(value) => update("treasuryTimelockSeconds", value)}
        />

        <TimelockField
          disabled={disabled}
          label="Upgrade delay in seconds"
          value={inputs.upgradeTimelockSeconds}
          onChange={(value) => update("upgradeTimelockSeconds", value)}
        />

        <TimelockField
          disabled={disabled}
          label="Emergency delay in seconds"
          value={inputs.emergencyTimelockSeconds}
          onChange={(value) => update("emergencyTimelockSeconds", value)}
        />
      </div>
    </section>
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
        inputMode="numeric"
        disabled={disabled}
        min="0"
        step="1"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
