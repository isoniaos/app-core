import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { OrganizationOverviewDto } from "@isonia/types";
import { Link, useParams } from "react-router-dom";
import { isAddress } from "viem";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useRuntimeConfig } from "../../config/runtime-config";
import { parseContractAbiJson } from "../known-contracts/abi/contract-abi";
import type { KnownContractRecord } from "../known-contracts/known-contracts-storage";
import { useKnownContracts } from "../known-contracts/known-contracts-storage";
import { useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  IsoConfirmDialog,
  IsoDialog,
  IsoTabs,
} from "../../ui-kit";
import { organizationDisplay } from "../../utils/display-labels";
import { formatAddress } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { useOrganizationDisplaySettings } from "./organization-display-settings";

interface ContractFormState {
  readonly abiJson: string;
  readonly address: string;
  readonly name: string;
}

const EMPTY_CONTRACT_FORM: ContractFormState = {
  abiJson: "",
  address: "",
  name: "",
};

export function OrganizationSettingsPage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const overview = useIsoniaQuery(
    () => client.getOrganizationOverview(orgId),
    [client, orgId],
  );

  return (
    <section className="page-stack">
      <AsyncContent
        state={overview}
        loadingTitle="Loading organization settings"
        loadingMessage="Reading organization context for local App Core settings."
        emptyTitle="Organization not found"
        emptyMessage={`No indexed organization was found for org #${orgId}.`}
        errorTitle="Unable to load organization settings"
      >
        {(data) => <OrganizationSettingsContent data={data} orgId={orgId} />}
      </AsyncContent>
    </section>
  );
}

function OrganizationSettingsContent({
  data,
  orgId,
}: {
  readonly data: OrganizationOverviewDto;
  readonly orgId: string;
}): JSX.Element {
  const metadata = useMetadata(data.organization.metadataUri);
  const indexedDisplay = organizationDisplay(data.organization, metadata.record);
  const { displayNameOverride } = useOrganizationDisplaySettings(orgId);
  const title = displayNameOverride ?? indexedDisplay.title;

  return (
    <>
      <PageHeader
        eyebrow={indexedDisplay.subtitle ?? `Organization #${orgId}`}
        title="Organization Settings"
        description={`${title} local App Core preferences and contract ABI records.`}
      />

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}`}>
          Back to overview
        </Link>
        <StatusBadge tone="muted">Browser local</StatusBadge>
      </div>

      <IsoTabs
        ariaLabel="Organization settings tabs"
        defaultValue="display-name"
        tabs={[
          {
            content: (
              <DisplayNameTab
                fallbackTitle={indexedDisplay.title}
                orgId={orgId}
              />
            ),
            label: "Display name",
            value: "display-name",
          },
          {
            content: <KnownContractsTab orgId={orgId} />,
            label: "Known contracts",
            value: "known-contracts",
          },
        ]}
      />
    </>
  );
}

function DisplayNameTab({
  fallbackTitle,
  orgId,
}: {
  readonly fallbackTitle: string;
  readonly orgId: string;
}): JSX.Element {
  const {
    clearDisplayNameOverride,
    displayNameOverride,
    setDisplayNameOverride,
  } = useOrganizationDisplaySettings(orgId);
  const [draft, setDraft] = useState(displayNameOverride ?? fallbackTitle);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(displayNameOverride ?? fallbackTitle);
  }, [displayNameOverride, fallbackTitle]);

  function submitDisplayName(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const saved = setDisplayNameOverride(draft);
    if (saved instanceof Error) {
      setError(saved.message);
      setMessage(undefined);
      return;
    }

    setError(undefined);
    setMessage("Local display label saved.");
  }

  function resetDisplayName(): void {
    clearDisplayNameOverride();
    setError(undefined);
    setMessage("Local display label cleared.");
  }

  return (
    <section className="panel organization-settings-panel">
      <div className="panel-header">
        <div>
          <h2>Display Name</h2>
          <p className="panel-subtitle">
            This is a local App Core display label. It does not update protocol
            state or Control Plane records.
          </p>
        </div>
        <StatusBadge tone={displayNameOverride ? "success" : "muted"}>
          {displayNameOverride ? "Override set" : "Using indexed label"}
        </StatusBadge>
      </div>
      <form className="form-grid" onSubmit={submitDisplayName}>
        <label className="form-field form-field-wide">
          <span>Organization display name</span>
          <input
            autoComplete="off"
            maxLength={120}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <span className="form-help-text">
            Indexed fallback: {fallbackTitle}
          </span>
          {error ? <span className="form-field-error-message">{error}</span> : null}
        </label>
        {message ? (
          <div className="inline-state inline-state-success form-field-wide">
            <strong>Settings updated</strong>
            <span>{message}</span>
          </div>
        ) : null}
        <div className="action-row form-field-wide">
          <button className="button button-primary" type="submit">
            Save display name
          </button>
          <button className="button" type="button" onClick={resetDisplayName}>
            Reset local label
          </button>
        </div>
      </form>
    </section>
  );
}

function KnownContractsTab({
  orgId,
}: {
  readonly orgId: string;
}): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const chainId = runtimeConfig.activeDeployment.chainId;
  const { contracts, deleteContract, saveContract } = useKnownContracts(
    orgId,
    chainId,
  );
  const [editingRecord, setEditingRecord] = useState<
    KnownContractRecord | "new" | undefined
  >(undefined);
  const [viewingAbi, setViewingAbi] = useState<KnownContractRecord | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<KnownContractRecord | undefined>(
    undefined,
  );

  return (
    <section className="panel organization-settings-panel">
      <div className="panel-header">
        <div>
          <h2>Known Contracts</h2>
          <p className="panel-subtitle">
            Local contract names and ABI labels are browser-local App Core
            configuration, not verified contract metadata or protocol authority.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setEditingRecord("new")}
        >
          Add contract
        </button>
      </div>

      {contracts.length === 0 ? (
        <div className="inline-state inline-state-muted">
          <strong>No local contracts saved</strong>
          <span>
            Add a contract ABI for chain {chainId} to build typed proposal
            actions.
          </span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Network</th>
                <th>Functions</th>
                <th>ABI</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contracts.map((record) => (
                <KnownContractRow
                  key={record.id}
                  record={record}
                  onDelete={() => setDeleteTarget(record)}
                  onEdit={() => setEditingRecord(record)}
                  onViewAbi={() => setViewingAbi(record)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContractEditorDialog
        chainId={chainId}
        orgId={orgId}
        record={editingRecord === "new" ? undefined : editingRecord}
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(undefined);
          }
        }}
        onSave={(draft) => {
          const saved = saveContract(draft);
          if (saved instanceof Error) {
            return saved;
          }
          setEditingRecord(undefined);
          return saved;
        }}
      />

      <AbiViewDialog
        record={viewingAbi}
        onOpenChange={(open) => {
          if (!open) {
            setViewingAbi(undefined);
          }
        }}
      />

      <IsoConfirmDialog
        body={
          <p>
            Delete {deleteTarget?.name ?? "this contract"} from local App Core
            settings for this organization and chain?
          </p>
        }
        confirmLabel="Delete"
        confirmTone="danger"
        description="This only removes the browser-local record. Protocol and Control Plane state are not changed."
        open={Boolean(deleteTarget)}
        title="Delete known contract"
        onConfirm={() => {
          if (deleteTarget) {
            deleteContract(deleteTarget.id);
          }
          setDeleteTarget(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(undefined);
          }
        }}
      />
    </section>
  );
}

function KnownContractRow({
  onDelete,
  onEdit,
  onViewAbi,
  record,
}: {
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onViewAbi: () => void;
  readonly record: KnownContractRecord;
}): JSX.Element {
  const summary = useMemo(() => getFunctionSummary(record.abiJson), [record.abiJson]);

  return (
    <tr>
      <td>
        <strong>{record.name}</strong>
        <span className="table-subtext">Local configuration</span>
      </td>
      <td className="mono-value">{formatAddress(record.address)}</td>
      <td>
        <strong>Chain {record.chainId}</strong>
        <span className="table-subtext">Active-network record</span>
      </td>
      <td>{summary}</td>
      <td>
        <button className="button button-small" type="button" onClick={onViewAbi}>
          View ABI
        </button>
      </td>
      <td className="table-action">
        <div className="action-row contract-table-actions">
          <button className="button button-small" type="button" onClick={onEdit}>
            Edit
          </button>
          <button className="button button-small" type="button" onClick={onDelete}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function ContractEditorDialog({
  chainId,
  onOpenChange,
  onSave,
  open,
  orgId,
  record,
}: {
  readonly chainId: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (
    draft: {
      readonly abiJson: string;
      readonly address: string;
      readonly chainId: number;
      readonly id?: string;
      readonly name: string;
      readonly orgId: string;
    },
  ) => KnownContractRecord | Error;
  readonly open: boolean;
  readonly orgId: string;
  readonly record?: KnownContractRecord;
}): JSX.Element {
  const [form, setForm] = useState<ContractFormState>(EMPTY_CONTRACT_FORM);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const abiState = useMemo(
    () => (form.abiJson.trim() ? parseContractAbiJson(form.abiJson) : undefined),
    [form.abiJson],
  );
  const validationErrors = getContractFormErrors(form, abiState);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      record
        ? {
            abiJson: record.abiJson,
            address: record.address,
            name: record.name,
          }
        : EMPTY_CONTRACT_FORM,
    );
    setSaveError(undefined);
  }, [open, record]);

  function submitContract(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (validationErrors.length > 0) {
      setSaveError(validationErrors[0]);
      return;
    }

    const saved = onSave({
      abiJson: form.abiJson,
      address: form.address,
      chainId,
      id: record?.id,
      name: form.name,
      orgId,
    });

    if (saved instanceof Error) {
      setSaveError(saved.message);
      return;
    }
  }

  return (
    <IsoDialog
      description="Paste a standard JSON ABI. The record is stored in this browser for the active organization and chain."
      footer={
        <div className="action-row dialog-action-row">
          <button className="button" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className="button button-primary" form="known-contract-form" type="submit">
            Save contract
          </button>
        </div>
      }
      open={open}
      title={record ? "Edit known contract" : "Add known contract"}
      onOpenChange={onOpenChange}
    >
      <form
        className="known-contract-form"
        id="known-contract-form"
        onSubmit={submitContract}
      >
        <label className="form-field">
          <span>Name</span>
          <input
            autoComplete="off"
            maxLength={120}
            type="text"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="form-field">
          <span>Address</span>
          <input
            autoComplete="off"
            className="mono-input"
            type="text"
            value={form.address}
            onChange={(event) =>
              setForm({ ...form, address: event.target.value })
            }
          />
        </label>
        <label className="form-field">
          <span>Network / chain ID</span>
          <input readOnly type="text" value={chainId} />
          <span className="form-help-text">
            v1 stores contracts for the active chain only.
          </span>
        </label>
        <label className="form-field">
          <span>ABI JSON</span>
          <textarea
            className="known-contract-abi-input mono-input"
            value={form.abiJson}
            onChange={(event) =>
              setForm({ ...form, abiJson: event.target.value })
            }
          />
        </label>
        <AbiValidationPanel abiState={abiState} errors={validationErrors} />
        {saveError ? (
          <div className="inline-state inline-state-danger">
            <strong>Cannot save contract</strong>
            <span>{saveError}</span>
          </div>
        ) : null}
      </form>
    </IsoDialog>
  );
}

function AbiValidationPanel({
  abiState,
  errors,
}: {
  readonly abiState: ReturnType<typeof parseContractAbiJson> | undefined;
  readonly errors: readonly string[];
}): JSX.Element {
  if (errors.length > 0) {
    return (
      <div className="inline-state inline-state-warning">
        <strong>Validation</strong>
        <span>{errors[0]}</span>
      </div>
    );
  }

  if (!abiState || abiState instanceof Error) {
    return (
      <div className="inline-state inline-state-muted">
        <strong>Validation</strong>
        <span>Paste ABI JSON to see callable function counts.</span>
      </div>
    );
  }

  return (
    <div className="inline-state inline-state-success">
      <strong>ABI parsed</strong>
      <span>
        {abiState.functions.length} functions, {abiState.readableCount} readable,
        {` ${abiState.writableCount}`} writable.
      </span>
    </div>
  );
}

function AbiViewDialog({
  onOpenChange,
  record,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly record?: KnownContractRecord;
}): JSX.Element {
  return (
    <IsoDialog
      description="Local user-provided ABI JSON. It is not verified contract metadata."
      open={Boolean(record)}
      title={record ? `${record.name} ABI` : "ABI"}
      onOpenChange={onOpenChange}
    >
      <textarea
        className="known-contract-abi-view mono-input"
        readOnly
        value={record ? formatAbiJson(record.abiJson) : ""}
      />
    </IsoDialog>
  );
}

function getContractFormErrors(
  form: ContractFormState,
  abiState: ReturnType<typeof parseContractAbiJson> | undefined,
): readonly string[] {
  const errors: string[] = [];

  if (!form.name.trim()) {
    errors.push("Contract name is required.");
  }

  if (!isAddress(form.address.trim())) {
    errors.push("Contract address must be a valid EVM address.");
  }

  if (!form.abiJson.trim()) {
    errors.push("ABI JSON is required.");
  } else if (abiState instanceof Error) {
    errors.push(abiState.message);
  }

  return errors;
}

function getFunctionSummary(abiJson: string): string {
  const parsed = parseContractAbiJson(abiJson);
  if (parsed instanceof Error) {
    return "Invalid ABI";
  }

  return `${parsed.functions.length} total, ${parsed.readableCount} readable, ${parsed.writableCount} writable`;
}

function formatAbiJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
