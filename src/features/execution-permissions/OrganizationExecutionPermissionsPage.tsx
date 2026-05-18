import type {
  ExecutionSelectorRuleDto,
  ExecutionTargetPermissionDto,
  ExecutionTargetRuleDto,
  OrganizationExecutionPermissionsDto,
} from "@isonia/types";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import {
  IsoAddressDisplay,
  IsoStatusPill,
  IsoTransactionHash,
  type IsoStatusPillTone,
} from "../../ui-kit";
import { formatLabel, formatNumericString } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { isNotFoundApiError } from "../accountability/accountability-display";

interface RuleMetadata {
  readonly updatedAtBlockNumber?: string;
  readonly updatedAtTxHash?: `0x${string}`;
  readonly updatedByAddress?: string;
}

interface CapabilityDisclosure {
  readonly detail?: string;
  readonly status?: string;
  readonly supported?: boolean;
}

export function OrganizationExecutionPermissionsPage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const permissions = useIsoniaQuery(
    () => client.executionPermissions.get(orgId),
    [client, orgId],
  );
  const runtimeConfig = useRuntimeConfig();

  if (permissions.loading) {
    return (
      <section className="page-stack execution-permissions-page-stack">
        <ExecutionPermissionsState
          title="Loading execution permissions"
          message="Reading the organization execution permission registry read model."
        />
      </section>
    );
  }

  if (isNotFoundApiError(permissions.error)) {
    return (
      <section className="page-stack execution-permissions-page-stack">
        <ExecutionPermissionsState
          title="Execution permissions unavailable"
          message="This Control Plane does not expose the v0.8 execution permissions endpoint for this organization yet."
        />
      </section>
    );
  }

  if (permissions.error) {
    return (
      <section className="page-stack execution-permissions-page-stack">
        <ExecutionPermissionsState
          actionLabel="Retry"
          message={permissions.error.message}
          title="Unable to load execution permissions"
          onAction={permissions.reload}
        />
      </section>
    );
  }

  if (!permissions.data) {
    return (
      <section className="page-stack execution-permissions-page-stack">
        <ExecutionPermissionsState
          title="Execution permissions missing"
          message="No execution permission registry response was returned for this organization."
        />
      </section>
    );
  }

  return (
    <OrganizationExecutionPermissionsContent
      blockExplorerUrl={runtimeConfig.blockExplorerUrl}
      orgId={orgId}
      permissions={permissions.data}
    />
  );
}

function OrganizationExecutionPermissionsContent({
  blockExplorerUrl,
  orgId,
  permissions,
}: {
  readonly blockExplorerUrl?: string;
  readonly orgId: string;
  readonly permissions: OrganizationExecutionPermissionsDto;
}): JSX.Element {
  const targets = permissions.targets;
  const enabledTargetCount = targets.filter((target) => target.enabled).length;
  const selectorCount = targets.reduce(
    (count, target) => count + target.selectors.length,
    0,
  );
  const enabledSelectorCount = targets.reduce(
    (count, target) =>
      count + target.selectors.filter((selector) => selector.enabled).length,
    0,
  );
  const disabledRuleCount =
    targets.filter((target) => !target.enabled).length +
    targets.reduce(
      (count, target) =>
        count + target.selectors.filter((selector) => !selector.enabled).length,
      0,
    );

  return (
    <section className="page-stack execution-permissions-page-stack">
      <PageHeader
        breadcrumbs={[
          { icon: "home", label: "Home", to: "/" },
          { icon: "building", label: `Org #${orgId}`, to: `/orgs/${orgId}` },
          { current: true, icon: "system", label: "Execution Permissions" },
        ]}
        eyebrow={`Organization #${permissions.orgId}`}
        title="Execution Permissions"
        description="Read-only registry view for modeled proposal execution targets and selectors."
      />

      <section className="panel execution-permissions-disclosure-panel">
        <div className="panel-header">
          <div>
            <h2>Protocol Registry Scope</h2>
            <p className="panel-subtitle">
              Execution permissions are protocol registry read models. They
              describe which targets/selectors the organization has enabled for
              proposal execution. They do not decode target-contract behavior
              and do not treat arbitrary target-contract events as governance
              authority.
            </p>
          </div>
          <div className="chip-row">
            <IsoStatusPill tone="muted">Read-only</IsoStatusPill>
            <IsoStatusPill tone="default">Protocol registry</IsoStatusPill>
            <CapabilityPill permissions={permissions} />
          </div>
        </div>
      </section>

      <div className="metric-grid execution-permissions-metric-grid">
        <ExecutionPermissionMetric
          label="Targets"
          value={targets.length.toLocaleString()}
          detail={`${enabledTargetCount.toLocaleString()} enabled`}
        />
        <ExecutionPermissionMetric
          label="Selectors"
          value={selectorCount.toLocaleString()}
          detail={`${enabledSelectorCount.toLocaleString()} enabled`}
        />
        <ExecutionPermissionMetric
          label="Disabled rules"
          value={disabledRuleCount.toLocaleString()}
          detail="Targets and selectors"
        />
        <ExecutionPermissionMetric
          label="Organization"
          value={`#${permissions.orgId}`}
          detail="Registry namespace"
        />
      </div>

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}/proposals`}>
          Proposals
        </Link>
        <Link className="button" to={`/orgs/${orgId}/governance`}>
          Governance Structure
        </Link>
      </div>

      {targets.length === 0 ? (
        <ExecutionPermissionsState
          title="No execution permissions indexed"
          message="No target or selector permission rules are currently known for this organization."
        />
      ) : (
        <div className="execution-permission-target-list">
          {targets.map((target) => (
            <ExecutionTargetRuleCard
              blockExplorerUrl={blockExplorerUrl}
              key={target.targetAddress.toLowerCase()}
              target={target}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ExecutionTargetRuleCard({
  blockExplorerUrl,
  target,
}: {
  readonly blockExplorerUrl?: string;
  readonly target: ExecutionTargetPermissionDto;
}): JSX.Element {
  return (
    <article className="product-card execution-permission-target-card">
      <div className="product-card-header execution-permission-target-header">
        <div>
          <h2>Target</h2>
          <IsoAddressDisplay copyable value={target.targetAddress} />
        </div>
        <div className="chip-row">
          <RuleStatePill enabled={target.enabled} />
          <IsoStatusPill tone="muted">
            {target.selectors.length.toLocaleString()} selectors
          </IsoStatusPill>
        </div>
      </div>

      <dl className="technical-detail-grid execution-permission-target-details">
        <ExecutionPermissionDetail
          label="Target address"
          mono
          value={target.targetAddress}
        />
        <ExecutionPermissionDetail
          label="Value limit"
          mono
          value={formatValueLimit(target.maxValue)}
        />
        <ExecutionPermissionDetail
          label="Target state"
          value={target.enabled ? "Enabled" : "Disabled"}
        />
      </dl>

      <RuleMetadataSummary
        blockExplorerUrl={blockExplorerUrl}
        metadata={target}
      />

      <section className="execution-permission-selector-section">
        <div className="execution-permission-selector-header">
          <div>
            <h3>Selector Rules</h3>
            <p>
              Selector entries are bytes4 protocol registry rules under this
              target.
            </p>
          </div>
          <IsoStatusPill tone="muted">
            {target.selectors.length.toLocaleString()} rules
          </IsoStatusPill>
        </div>

        {target.selectors.length === 0 ? (
          <div className="calm-state">
            <strong>No selector rules indexed</strong>
            <span>
              The registry response did not include selector-specific rules for
              this target.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="execution-permission-selector-table">
              <thead>
                <tr>
                  <th>Selector</th>
                  <th>State</th>
                  <th>Updated block</th>
                  <th>Updated tx</th>
                  <th>Updated by</th>
                </tr>
              </thead>
              <tbody>
                {target.selectors.map((selector) => (
                  <ExecutionSelectorRuleRow
                    blockExplorerUrl={blockExplorerUrl}
                    key={`${target.targetAddress.toLowerCase()}:${selector.selector}`}
                    selector={selector}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}

function ExecutionSelectorRuleRow({
  blockExplorerUrl,
  selector,
}: {
  readonly blockExplorerUrl?: string;
  readonly selector: ExecutionSelectorRuleDto;
}): JSX.Element {
  return (
    <tr>
      <td>
        <code>{selector.selector}</code>
      </td>
      <td>
        <RuleStatePill enabled={selector.enabled} />
      </td>
      <td>{selector.updatedAtBlockNumber ?? "Not provided"}</td>
      <td>
        {selector.updatedAtTxHash ? (
          <IsoTransactionHash
            blockExplorerUrl={blockExplorerUrl}
            txHash={selector.updatedAtTxHash}
          />
        ) : (
          "Not provided"
        )}
      </td>
      <td>
        {selector.updatedByAddress ? (
          <IsoAddressDisplay
            copyable
            showAvatar={false}
            size="compact"
            value={selector.updatedByAddress}
          />
        ) : (
          "Not provided"
        )}
      </td>
    </tr>
  );
}

function RuleMetadataSummary({
  blockExplorerUrl,
  metadata,
}: {
  readonly blockExplorerUrl?: string;
  readonly metadata: ExecutionTargetRuleDto | RuleMetadata;
}): JSX.Element {
  const hasMetadata =
    Boolean(metadata.updatedAtBlockNumber) ||
    Boolean(metadata.updatedAtTxHash) ||
    Boolean(metadata.updatedByAddress);

  if (!hasMetadata) {
    return (
      <div className="calm-state">
        <strong>No update metadata</strong>
        <span>
          The registry response did not include block, transaction, or source
          address metadata for this rule.
        </span>
      </div>
    );
  }

  return (
    <dl className="execution-permission-metadata-grid">
      <ExecutionPermissionDetail
        label="Updated block"
        mono
        value={metadata.updatedAtBlockNumber ?? "Not provided"}
      />
      <ExecutionPermissionDetail
        label="Updated tx"
        value={
          metadata.updatedAtTxHash ? (
            <IsoTransactionHash
              blockExplorerUrl={blockExplorerUrl}
              txHash={metadata.updatedAtTxHash}
            />
          ) : (
            "Not provided"
          )
        }
      />
      <ExecutionPermissionDetail
        label="Updated by"
        value={
          metadata.updatedByAddress ? (
            <IsoAddressDisplay
              copyable
              showAvatar={false}
              size="compact"
              value={metadata.updatedByAddress}
            />
          ) : (
            "Not provided"
          )
        }
      />
    </dl>
  );
}

function ExecutionPermissionMetric({
  detail,
  label,
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="metric execution-permission-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ExecutionPermissionDetail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "technical-code" : undefined}>{value}</dd>
    </div>
  );
}

function RuleStatePill({
  enabled,
}: {
  readonly enabled: boolean;
}): JSX.Element {
  return (
    <IsoStatusPill tone={enabled ? "success" : "muted"}>
      {enabled ? "Enabled" : "Disabled"}
    </IsoStatusPill>
  );
}

function CapabilityPill({
  permissions,
}: {
  readonly permissions: OrganizationExecutionPermissionsDto;
}): JSX.Element | null {
  const capability = readCapabilityDisclosure(permissions);

  if (!capability) {
    return null;
  }

  const label =
    capability.status ??
    (capability.supported === true
      ? "Supported"
      : capability.supported === false
        ? "Unsupported"
        : "Capability reported");

  return (
    <IsoStatusPill tone={capabilityTone(capability)}>
      {formatLabel(label)}
    </IsoStatusPill>
  );
}

function ExecutionPermissionsState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="calm-state execution-permissions-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {onAction && actionLabel ? (
        <button className="button button-small" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function formatValueLimit(value: string | undefined): string {
  const formatted = formatNumericString(value);
  return formatted === "Not set" ? formatted : `${formatted} wei`;
}

function readCapabilityDisclosure(
  permissions: OrganizationExecutionPermissionsDto,
): CapabilityDisclosure | undefined {
  const record = permissions as unknown as Record<string, unknown>;
  const supported = readOptionalBoolean(record, "supported");
  const status =
    readOptionalString(record, "capabilityStatus") ??
    readOptionalString(record, "supportStatus");
  const detail =
    readOptionalString(record, "capabilityDetail") ??
    readOptionalString(record, "supportDetail");

  if (supported === undefined && !status && !detail) {
    return undefined;
  }

  return { detail, status, supported };
}

function readOptionalString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function readOptionalBoolean(
  record: Readonly<Record<string, unknown>>,
  key: string,
): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function capabilityTone(
  capability: CapabilityDisclosure,
): IsoStatusPillTone {
  if (capability.supported === true) {
    return "success";
  }

  if (capability.supported === false) {
    return "warning";
  }

  const status = capability.status?.toLowerCase();
  if (!status) {
    return "muted";
  }

  if (["supported", "available", "enabled"].includes(status)) {
    return "success";
  }

  if (["unsupported", "unavailable", "disabled"].includes(status)) {
    return "warning";
  }

  return "muted";
}
