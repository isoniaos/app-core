import type {
  OrganizationManagedExecutionDto,
  OrgExecutorDto,
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
} from "../../ui-kit";
import { requireParam } from "../../utils/route-params";
import {
  formatIsoDateTime,
  isNotFoundApiError,
} from "../accountability/accountability-display";

export function OrganizationManagedExecutionPage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const managedExecution = useIsoniaQuery(
    () => client.managedExecution.get(orgId),
    [client, orgId],
  );
  const runtimeConfig = useRuntimeConfig();

  if (managedExecution.loading) {
    return (
      <section className="page-stack managed-execution-page-stack">
        <ManagedExecutionState
          title="Loading managed execution"
          message="Reading the organization managed execution read model."
        />
      </section>
    );
  }

  if (isNotFoundApiError(managedExecution.error)) {
    return (
      <section className="page-stack managed-execution-page-stack">
        <ManagedExecutionState
          title="Managed execution unavailable"
          message="This Control Plane does not expose the v0.8 managed execution endpoint for this organization yet."
        />
      </section>
    );
  }

  if (managedExecution.error) {
    return (
      <section className="page-stack managed-execution-page-stack">
        <ManagedExecutionState
          actionLabel="Retry"
          message={managedExecution.error.message}
          title="Unable to load managed execution"
          onAction={managedExecution.reload}
        />
      </section>
    );
  }

  if (!managedExecution.data) {
    return (
      <section className="page-stack managed-execution-page-stack">
        <ManagedExecutionState
          title="Managed execution missing"
          message="No managed execution registry response was returned for this organization."
        />
      </section>
    );
  }

  return (
    <OrganizationManagedExecutionContent
      blockExplorerUrl={runtimeConfig.activeDeployment.blockExplorerUrl}
      managedExecution={managedExecution.data}
      orgId={orgId}
    />
  );
}

function OrganizationManagedExecutionContent({
  blockExplorerUrl,
  managedExecution,
  orgId,
}: {
  readonly blockExplorerUrl?: string;
  readonly managedExecution: OrganizationManagedExecutionDto;
  readonly orgId: string;
}): JSX.Element {
  const executor = managedExecution.executor;
  const activeExecutorAddress = executor?.executorAddress;

  return (
    <section className="page-stack managed-execution-page-stack">
      <PageHeader
        breadcrumbs={[
          { icon: "home", label: "Home", to: "/" },
          { icon: "building", label: `Org #${orgId}`, to: `/orgs/${orgId}` },
          { current: true, icon: "system", label: "Managed Execution" },
        ]}
        eyebrow={`Organization #${managedExecution.orgId}`}
        title="Managed Execution"
        description="Read-only organization executor configuration for managed proposal execution."
      />

      <section className="panel managed-execution-disclosure-panel">
        <div className="panel-header">
          <div>
            <h2>Managed Execution Scope</h2>
            <p className="panel-subtitle">
              Managed execution means the governance protocol forwarded a
              proposal through an executor configured for this organization. The
              executor is org-scoped and is not a global Isonia superadmin.
            </p>
          </div>
          <div className="chip-row">
            <IsoStatusPill tone="muted">Read-only</IsoStatusPill>
            <IsoStatusPill tone="default">Protocol read model</IsoStatusPill>
          </div>
        </div>
        <div className="inline-state inline-state-muted managed-execution-boundary">
          <strong>Authority boundary</strong>
          <span>
            Contracts remain authoritative for modeled onchain governance state.
            Target-contract events remain evidence or context unless a future
            adapter explicitly models them as authority, and App Core does not
            infer customer ABI method names here.
          </span>
        </div>
      </section>

      <div className="metric-grid managed-execution-metric-grid">
        <ManagedExecutionMetric
          label="Organization"
          value={`#${managedExecution.orgId}`}
          detail="Executor namespace"
        />
        <ManagedExecutionMetric
          label="Active executor"
          value={activeExecutorAddress ? "Configured" : "Not configured"}
          detail="Org-scoped forwarding context"
        />
        <ManagedExecutionMetric
          label="Updated block"
          value={executor?.blockNumber ?? "Not reported"}
          detail="Read-model metadata"
        />
        <ManagedExecutionMetric
          label="Last update"
          value={formatIsoDateTime(executor?.updatedAt)}
          detail="Observed by Control Plane"
        />
      </div>

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}/proposals`}>
          Proposals
        </Link>
        <Link className="button" to={`/orgs/${orgId}/execution-permissions`}>
          Execution Permissions
        </Link>
      </div>

      <section className="product-card managed-execution-executor-card">
        <div className="product-card-header">
          <div>
            <h2>Organization Executor</h2>
            <p>
              The active executor changes the execution context for managed
              execution. It does not change final target permission semantics.
            </p>
          </div>
          <IsoStatusPill tone={activeExecutorAddress ? "success" : "muted"}>
            {activeExecutorAddress ? "Executor configured" : "No active executor"}
          </IsoStatusPill>
        </div>

        {activeExecutorAddress ? (
          <dl className="technical-detail-grid managed-execution-executor-grid">
            <ManagedExecutionDetail
              label="Organization id"
              value={managedExecution.orgId}
              mono
            />
            <ManagedExecutionDetail
              label="Active executor address"
              value={<IsoAddressDisplay copyable value={activeExecutorAddress} />}
            />
            <ManagedExecutionDetail
              label="Executor scope"
              value="Organization scoped"
            />
          </dl>
        ) : (
          <ManagedExecutionState
            title="No active executor configured"
            message="This organization currently has no active managed executor in the read model. Direct execution can still be represented by proposal receipts when the protocol emits it."
          />
        )}
      </section>

      <ManagedExecutionMetadata
        blockExplorerUrl={blockExplorerUrl}
        executor={executor}
      />
    </section>
  );
}

function ManagedExecutionMetadata({
  blockExplorerUrl,
  executor,
}: {
  readonly blockExplorerUrl?: string;
  readonly executor?: OrgExecutorDto;
}): JSX.Element {
  const hasMetadata =
    Boolean(executor?.previousExecutorAddress) ||
    Boolean(executor?.updatedByAddress) ||
    Boolean(executor?.updatedAt) ||
    Boolean(executor?.transactionHash) ||
    Boolean(executor?.blockNumber);

  return (
    <section className="product-card">
      <div className="product-card-header">
        <div>
          <h2>Read-Model Metadata</h2>
          <p>
            Event-derived metadata from the org executor read model, when the
            Control Plane has indexed it.
          </p>
        </div>
      </div>
      {hasMetadata && executor ? (
        <dl className="technical-detail-grid managed-execution-metadata-grid">
          <ManagedExecutionDetail
            label="Previous executor"
            value={
              executor.previousExecutorAddress ? (
                <IsoAddressDisplay
                  copyable
                  showAvatar={false}
                  size="compact"
                  value={executor.previousExecutorAddress}
                />
              ) : (
                "Not reported"
              )
            }
          />
          <ManagedExecutionDetail
            label="Updated by"
            value={
              executor.updatedByAddress ? (
                <IsoAddressDisplay
                  copyable
                  showAvatar={false}
                  size="compact"
                  value={executor.updatedByAddress}
                />
              ) : (
                "Not reported"
              )
            }
          />
          <ManagedExecutionDetail
            label="Updated at"
            value={formatIsoDateTime(executor.updatedAt)}
          />
          <ManagedExecutionDetail
            label="Updated block"
            value={executor.blockNumber ?? "Not reported"}
            mono
          />
          <ManagedExecutionDetail
            label="Updated tx"
            value={
              executor.transactionHash ? (
                <IsoTransactionHash
                  blockExplorerUrl={blockExplorerUrl}
                  txHash={executor.transactionHash}
                />
              ) : (
                "Not reported"
              )
            }
          />
          <ManagedExecutionDetail
            label="Event scope"
            value="Org executor registry"
          />
        </dl>
      ) : (
        <ManagedExecutionState
          title="No update metadata"
          message="The managed execution response did not include block, transaction, timestamp, or updater metadata."
        />
      )}
    </section>
  );
}

function ManagedExecutionMetric({
  detail,
  label,
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="metric managed-execution-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ManagedExecutionDetail({
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

function ManagedExecutionState({
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
    <div className="calm-state managed-execution-state">
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
