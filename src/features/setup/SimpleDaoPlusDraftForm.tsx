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

        <label className="form-field form-field-wide">
          <span>Organization admin address</span>
          <input
            autoComplete="off"
            className="mono-input"
            disabled={disabled}
            placeholder="0x..."
            type="text"
            value={inputs.organizationAdminAddress}
            onChange={(event) =>
              update("organizationAdminAddress", event.target.value)
            }
          />
        </label>

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

        <label className="form-field">
          <span>Executor holder address</span>
          <input
            autoComplete="off"
            className="mono-input"
            disabled={disabled}
            placeholder="0x..."
            type="text"
            value={inputs.executorHolderAddress}
            onChange={(event) =>
              update("executorHolderAddress", event.target.value)
            }
          />
        </label>

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
          label="Standard timelock"
          value={inputs.standardTimelockSeconds}
          onChange={(value) => update("standardTimelockSeconds", value)}
        />

        <TimelockField
          disabled={disabled}
          label="Treasury timelock"
          value={inputs.treasuryTimelockSeconds}
          onChange={(value) => update("treasuryTimelockSeconds", value)}
        />

        <TimelockField
          disabled={disabled}
          label="Upgrade timelock"
          value={inputs.upgradeTimelockSeconds}
          onChange={(value) => update("upgradeTimelockSeconds", value)}
        />

        <TimelockField
          disabled={disabled}
          label="Emergency timelock"
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
    <label className="form-field form-field-wide">
      <span>{label}</span>
      <textarea
        autoComplete="off"
        className="mono-input"
        disabled={disabled}
        placeholder={"0x...\n0x..."}
        rows={3}
        value={value.join("\n")}
        onChange={(event) => onChange(parseAddressList(event.target.value))}
      />
    </label>
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

function parseAddressList(value: string): readonly string[] {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
