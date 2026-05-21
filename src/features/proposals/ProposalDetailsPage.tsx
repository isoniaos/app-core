import type {
  BodyDto,
  OrganizationExecutionPermissionsDto,
  ProposalDto,
  ProposalExecutionReceiptDto,
  ProposalRouteExplanationDto,
  RoleDto,
} from "@isonia/types";
import { ProposalExecutionMode, ProposalStatus } from "@isonia/types";
import {
  hasKnownActionSelector,
  type IsoniaControlPlaneClient,
} from "@isonia/sdk";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useOrganizationFinalization } from "../../api/useOrganizationFinalization";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useRuntimeConfig } from "../../config/runtime-config";
import { AccountabilityRecordPanel } from "../accountability/AccountabilityRecordPanel";
import { formatIsoDateTime } from "../accountability/accountability-display";
import { DecisionRecordPanel } from "../accountability/DecisionRecordPanel";
import { ExternalResourcesPanel } from "../accountability/ExternalResourcesPanel";
import { type MetadataState, useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import {
  IsoStatusPill,
  IsoBreadcrumbs,
  IsoTabs,
  IsoTransactionHash,
  type IsoStatusPillTone,
} from "../../ui-kit";
import { proposalDisplay } from "../../utils/display-labels";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
  formatNumericString,
} from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { DemoTargetResultPanel } from "./DemoTargetResultPanel";
import { LocalHardhatTimeControls } from "./LocalHardhatTimeControls";
import { ProposalActionsPanel } from "./ProposalActionsPanel";
import {
  RouteExplanationPanel,
  type RouteFallbackContext,
} from "./RouteExplanationPanel";
import { useDemoProposalExecution } from "./useDemoProposalExecution";
import { useProposalAction } from "./useProposalAction";
import { getExecutorBodyLabel } from "./proposal-body-labels";
import {
  getProposalNextActionContext,
  getProposalStatusTone,
  getRouteOverviewMetricLabel,
  getRouteReadinessDisplay,
} from "./proposal-route-display";
import {
  getExecutionPermissionNotice,
  getPermissionActionIdentity,
} from "./proposal-execution-boundary";

interface ProposalDetailsData {
  readonly bodies: readonly BodyDto[];
  readonly executionPermissions: OrganizationExecutionPermissionsDto | undefined;
  readonly executionPermissionsError: Error | undefined;
  readonly orgAdminAddress: string | undefined;
  readonly proposal: ProposalDto;
  readonly route: ProposalRouteExplanationDto | undefined;
  readonly routeError: Error | undefined;
  readonly roles: readonly RoleDto[];
}

interface RouteLoadResult {
  readonly route: ProposalRouteExplanationDto | undefined;
  readonly routeError: Error | undefined;
}

interface ExecutionPermissionsLoadResult {
  readonly executionPermissions: OrganizationExecutionPermissionsDto | undefined;
  readonly executionPermissionsError: Error | undefined;
}

export function ProposalDetailsPage(): JSX.Element {
  const client = useIsoniaClient();
  const params = useParams();
  const orgId = requireParam(params.orgId, "orgId");
  const proposalId = requireParam(params.proposalId, "proposalId");
  const details = useIsoniaQuery(
    async (): Promise<ProposalDetailsData> => {
      const [
        proposal,
        routeResult,
        overview,
        bodies,
        roles,
        executionPermissionsResult,
      ] = await Promise.all([
        client.getProposal(orgId, proposalId),
        loadProposalRoute(client, orgId, proposalId),
        client.getOrganizationOverview(orgId),
        client.getBodies(orgId),
        client.getRoles(orgId),
        loadExecutionPermissions(client, orgId),
      ]);
      return {
        bodies,
        orgAdminAddress: overview.organization.adminAddress,
        proposal,
        roles,
        ...executionPermissionsResult,
        ...routeResult,
      };
    },
    [client, orgId, proposalId],
  );
  const metadata = useMetadata(details.data?.proposal.descriptionUri);

  return (
    <section className="page-stack proposal-page-stack">
      <AsyncContent
        state={details}
        loadingTitle="Loading proposal"
        loadingMessage="Reading proposal details and route explanation."
        emptyTitle="Proposal not found"
        emptyMessage={`No indexed proposal #${proposalId} was found for org #${orgId}.`}
        errorTitle="Unable to load proposal"
      >
        {({
          bodies,
          executionPermissions,
          executionPermissionsError,
          orgAdminAddress,
          proposal,
          roles,
          route,
          routeError,
        }) => (
          <ProposalDetailsContent
            bodies={bodies}
            executionPermissions={executionPermissions}
            executionPermissionsError={executionPermissionsError}
            metadata={metadata}
            orgAdminAddress={orgAdminAddress}
            orgId={orgId}
            proposal={proposal}
            roles={roles}
            route={route}
            routeError={routeError}
            onReload={() => details.reload()}
          />
        )}
      </AsyncContent>
    </section>
  );
}

function ProposalDetailsContent({
  bodies,
  executionPermissions,
  executionPermissionsError,
  metadata,
  orgAdminAddress,
  orgId,
  onReload,
  proposal,
  roles,
  route,
  routeError,
}: {
  readonly bodies: readonly BodyDto[];
  readonly executionPermissions?: OrganizationExecutionPermissionsDto;
  readonly executionPermissionsError?: Error;
  readonly metadata: MetadataState;
  readonly orgAdminAddress: string | undefined;
  readonly orgId: string;
  readonly onReload: () => void;
  readonly proposal: ProposalDto;
  readonly roles: readonly RoleDto[];
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const finalization = useOrganizationFinalization(orgId);
  const proposalText = proposalDisplay(proposal, metadata.record);
  const proposalAction = useProposalAction({
    proposal,
    onIndexed: () => onReload(),
  });
  const { demoExecution, demoNumber, setDemoNumber } =
    useDemoProposalExecution({
      metadata: metadata.record,
      proposal,
    });
  const routeFallback: RouteFallbackContext = {
    chainId: proposal.chainId,
    orgId: proposal.orgId,
    proposalId: proposal.proposalId,
    proposalType: proposal.proposalType,
    policyVersion: proposal.policyVersion,
    status: proposal.status,
  };
  const headerDescription =
    proposalText.description ??
    `${formatLabel(
      proposal.proposalType,
    )} proposal using policy snapshot v${proposal.policyVersion}.`;
  const routeReadiness = getRouteReadinessDisplay({
    route,
    routeError,
    status: proposal.status,
  });

  return (
    <>
      <header className="proposal-detail-header">
        <IsoBreadcrumbs
          ariaLabel="Proposal breadcrumb"
          items={[
            {
              icon: "home",
              label: "Home",
              to: "/",
            },
            {
              icon: "proposals",
              label: "Proposals",
              to: `/orgs/${orgId}/proposals`,
            },
            {
              current: true,
              icon: "job",
              label: `Proposal #${proposal.proposalId}`,
            },
          ]}
        />
        <div className="proposal-detail-header-main">
          <div className="proposal-detail-title-block">
            <h1>{proposalText.title}</h1>
            <p>{headerDescription}</p>
            <div className="proposal-status-row">
              <IsoStatusPill tone={getProposalStatusTone(proposal.status)}>
                {formatLabel(proposal.status)}
              </IsoStatusPill>
              <IsoStatusPill tone={routeReadiness.tone}>
                {routeReadiness.label}
              </IsoStatusPill>
              <IsoStatusPill tone="muted">
                Policy v{proposal.policyVersion}
              </IsoStatusPill>
              <LifecyclePills proposal={proposal} />
            </div>
          </div>
          <Link className="button" to={`/orgs/${orgId}/proposals`}>
            Back to proposals
          </Link>
        </div>
      </header>

      <div className="proposal-detail-layout">
        <main className="proposal-detail-main" aria-label="Proposal content">
          <IsoTabs
            ariaLabel="Proposal detail sections"
            className="proposal-tabs"
            defaultValue="overview"
            tabs={[
              {
                content: (
                  <ProposalOverviewTab
                    blockExplorerUrl={runtimeConfig.blockExplorerUrl}
                    bodies={bodies}
                    executionPermissions={executionPermissions}
                    executionPermissionsError={executionPermissionsError}
                    metadata={metadata}
                    proposal={proposal}
                    route={route}
                    routeError={routeError}
                  />
                ),
                label: "Overview",
                value: "overview",
              },
              {
                content: (
                  <RouteExplanationPanel
                    bodies={bodies}
                    fallback={routeFallback}
                    route={route}
                    routeError={routeError}
                    showTechnicalDetails={false}
                  />
                ),
                label: "Route",
                value: "route",
              },
              {
                content: (
                  <DecisionRecordPanel
                    orgId={orgId}
                    proposalId={proposal.proposalId}
                  />
                ),
                label: "Decision Record",
                value: "decision-record",
              },
              {
                content: (
                  <AccountabilityRecordPanel
                    blockExplorerUrl={runtimeConfig.blockExplorerUrl}
                    orgId={orgId}
                    proposalId={proposal.proposalId}
                  />
                ),
                label: "Accountability",
                value: "accountability",
              },
              {
                content: (
                  <ExternalResourcesPanel
                    orgId={orgId}
                    proposalId={proposal.proposalId}
                  />
                ),
                label: "Evidence",
                value: "evidence",
              },
              {
                content: (
                  <ProposalActionsPanel
                    bodies={bodies}
                    busy={proposalAction.busy}
                    demoExecution={demoExecution}
                    demoNumber={demoNumber}
                    onDemoNumberChange={setDemoNumber}
                    orgAdminAddress={orgAdminAddress}
                    organizationFinalized={finalization.finalized}
                    proposal={proposal}
                    readiness={proposalAction.readiness}
                    roles={roles}
                    route={route}
                    routeError={routeError}
                    runAction={proposalAction.runAction}
                    transaction={proposalAction.transaction}
                  />
                ),
                label: "Actions",
                value: "actions",
              },
              {
                content: (
                  <ProposalExecutionResultTab
                    demoExecution={demoExecution}
                    demoNumber={demoNumber}
                    proposal={proposal}
                    transaction={proposalAction.transaction}
                    onRefresh={onReload}
                  />
                ),
                label: "Execution Result",
                value: "execution-result",
              },
              {
                content: (
                  <ProposalTechnicalTab
                    bodies={bodies}
                    blockExplorerUrl={runtimeConfig.blockExplorerUrl}
                    proposal={proposal}
                    route={route}
                    routeError={routeError}
                  />
                ),
                label: "Technical",
                value: "technical",
              },
            ]}
          />
        </main>

        <aside className="proposal-detail-aside" aria-label="Proposal context">
          <ProposalInfoCard
            blockExplorerUrl={runtimeConfig.blockExplorerUrl}
            proposal={proposal}
          />
          <NextActionCard
            bodies={bodies}
            proposal={proposal}
            route={route}
            routeError={routeError}
          />
        </aside>
      </div>
    </>
  );
}

function ProposalOverviewTab({
  blockExplorerUrl,
  bodies,
  executionPermissions,
  executionPermissionsError,
  metadata,
  proposal,
  route,
  routeError,
}: {
  readonly blockExplorerUrl?: string;
  readonly bodies: readonly BodyDto[];
  readonly executionPermissions?: OrganizationExecutionPermissionsDto;
  readonly executionPermissionsError?: Error;
  readonly metadata: MetadataState;
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): JSX.Element {
  const hasMetadataUri = hasDisplayValue(proposal.descriptionUri);
  const metadataMissing = !hasMetadataUri;
  const metadataUnavailable =
    hasMetadataUri && !metadata.loading && !metadata.record;
  const routeReadiness = getRouteReadinessDisplay({
    route,
    routeError,
    status: proposal.status,
  });

  return (
    <div className="proposal-overview-grid">
      <section className="product-card proposal-summary-card">
        <div className="product-card-header">
          <div>
            <h2>Proposal Summary</h2>
            <p>Human-readable state from indexed proposal data.</p>
          </div>
          <IsoStatusPill tone={getProposalStatusTone(proposal.status)}>
            {formatLabel(proposal.status)}
          </IsoStatusPill>
        </div>
        <dl className="proposal-fact-grid">
          <Fact label="Type" value={formatLabel(proposal.proposalType)} />
          <Fact label="Status" value={formatLabel(proposal.status)} />
          <Fact
            label="Target"
            value={
              proposal.targetAddress
                ? formatAddress(proposal.targetAddress)
                : "No target address"
            }
          />
          <Fact label="Value" value={proposal.value} />
          <Fact
            label="Metadata"
            value={
              metadata.record
                ? "Resolved"
                : metadata.loading
                  ? "Loading"
                  : hasMetadataUri
                    ? "Unavailable"
                    : "Missing"
            }
          />
          <Fact
            label="Data"
            value={proposal.dataStatus ? formatLabel(proposal.dataStatus) : "Observed"}
          />
        </dl>
        {metadataMissing ? (
          <CalmState
            title="Missing metadata"
            message="No proposal metadata URI was indexed, so App Core is showing chain-derived fallback fields."
          />
        ) : metadataUnavailable ? (
          <CalmState
            title="Metadata unavailable"
            message="The metadata URI could not be resolved. Proposal type and chain-derived identifiers remain available."
          />
        ) : null}
      </section>

      <section className="product-card product-card-wide">
        <div className="product-card-header">
          <div>
            <h2>Protocol Action Identity</h2>
            <p>
              Proposal action identity is target address, value,
              protocol-declared action selector, and data hash. The selector is
              an execution check input, not a decoded method name.
            </p>
          </div>
          <IsoStatusPill tone={hasKnownActionSelector(proposal) ? "default" : "warning"}>
            {hasKnownActionSelector(proposal) ? "Selector known" : "Legacy read model"}
          </IsoStatusPill>
        </div>
        <dl className="technical-detail-grid">
          <TechDetail
            label="Target address"
            value={proposal.targetAddress ?? "No target address indexed"}
            mono
          />
          <TechDetail
            label="Value"
            value={formatValueLimit(proposal.value)}
            mono
          />
          <TechDetail
            label="Protocol-declared action selector"
            value={formatProposalActionSelector(proposal)}
            mono
          />
          <TechDetail
            label="Data hash"
            value={proposal.dataHash ?? "No data hash indexed"}
            mono
          />
        </dl>
        <div className="inline-state inline-state-muted">
          <strong>Authority boundary</strong>
          <span>
            Contracts remain authoritative for modeled onchain governance state.
            Decoded method labels require future ABI or action metadata, and
            target-contract events are not governance authority by themselves.
          </span>
        </div>
        {hasKnownActionSelector(proposal) ? null : (
          <CalmState
            title="Action selector unavailable"
            message="This proposal read model does not expose the protocol-declared bytes4 selector. App Core will not infer it from dataHash, parse calldata, or map it to an ABI method name."
          />
        )}
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Lifecycle</h2>
            <p>Current indexed lifecycle milestones.</p>
          </div>
        </div>
        <ProposalLifecycleTimeline proposal={proposal} />
      </section>

      <ExecutionPermissionNotice
        permissions={executionPermissions}
        permissionsError={executionPermissionsError}
        proposal={proposal}
      />

      <ProposalExecutionReceiptCard
        blockExplorerUrl={blockExplorerUrl}
        proposal={proposal}
      />

      <section className="product-card product-card-wide">
        <div className="product-card-header">
          <div>
            <h2>Route Snapshot</h2>
            <p>Approval, veto, timelock, and execution readiness.</p>
          </div>
          <IsoStatusPill tone={routeReadiness.tone}>
            {routeReadiness.label}
          </IsoStatusPill>
        </div>
        <RouteOverviewCards
          bodies={bodies}
          proposal={proposal}
          route={route}
          routeError={routeError}
        />
      </section>
    </div>
  );
}

function ProposalExecutionResultTab({
  demoExecution,
  demoNumber,
  onRefresh,
  proposal,
  transaction,
}: Parameters<typeof DemoTargetResultPanel>[0]): JSX.Element {
  return (
    <div className="proposal-result-tab">
      <DemoTargetResultPanel
        demoExecution={demoExecution}
        demoNumber={demoNumber}
        proposal={proposal}
        transaction={transaction}
        onRefresh={onRefresh}
      />
      <LocalHardhatTimeControls onAdvanced={onRefresh} />
    </div>
  );
}

function ProposalInfoCard({
  blockExplorerUrl,
  proposal,
}: {
  readonly blockExplorerUrl?: string;
  readonly proposal: ProposalDto;
}): JSX.Element {
  return (
    <section className="context-card">
      <div className="context-card-header">
        <h2>Proposal Information</h2>
      </div>
      <dl className="context-detail-list">
        <InfoRow label="Proposal ID" value={proposal.proposalId} />
        <InfoRow label="Org ID" value={proposal.orgId} />
        <InfoRow label="Policy version" value={`v${proposal.policyVersion}`} />
        <InfoRow label="Created" value={formatChainTime(proposal.createdAtChain)} />
        <InfoRow
          label="Created tx"
          value={
            <IsoTransactionHash
              blockExplorerUrl={blockExplorerUrl}
              txHash={proposal.createdTxHash}
            />
          }
        />
        <InfoRow label="Queued" value={formatChainTime(proposal.queuedAtChain)} />
        <InfoRow
          label="Executable"
          value={
            proposal.executableAtChain
              ? formatChainTime(proposal.executableAtChain)
              : "Not queued"
          }
        />
        <InfoRow
          label="Executed"
          value={formatChainTime(proposal.executedAtChain)}
        />
        {proposal.executionMode ? (
          <InfoRow
            label="Execution mode"
            value={formatLabel(proposal.executionMode)}
          />
        ) : null}
        {proposal.managedExecutorAddress ? (
          <InfoRow
            label="Managed executor"
            value={formatAddress(proposal.managedExecutorAddress)}
          />
        ) : null}
      </dl>
    </section>
  );
}

function ProposalExecutionReceiptCard({
  blockExplorerUrl,
  proposal,
}: {
  readonly blockExplorerUrl?: string;
  readonly proposal: ProposalDto;
}): JSX.Element | null {
  const receipt = proposal.executionReceipt;
  const executionMode = receipt?.executionMode ?? proposal.executionMode;
  const managedExecutorAddress =
    receipt?.managedExecutorAddress ?? proposal.managedExecutorAddress;

  if (!receipt && !executionMode && !managedExecutorAddress) {
    return null;
  }

  const isManaged = executionMode === ProposalExecutionMode.Managed;

  return (
    <section className="product-card product-card-wide proposal-execution-receipt-card">
      <div className="product-card-header">
        <div>
          <h2>Canonical Execution Receipt</h2>
          <p>
            Protocol execution receipt emitted by governance execution. This is
            not customer ABI decoding and does not treat target-contract events
            as authority.
          </p>
        </div>
        <IsoStatusPill tone={isManaged ? "default" : "muted"}>
          {executionMode ? formatLabel(executionMode) : "Receipt metadata"}
        </IsoStatusPill>
      </div>
      <div className="inline-state inline-state-muted proposal-execution-receipt-boundary">
        <strong>Execution boundary</strong>
        <span>
          Direct execution calls the final target from the protocol. Managed
          execution forwards through the org-scoped executor and still preserves
          final target, value, selector, and data hash as the canonical action
          identity. No customer ABI method names are inferred here.
        </span>
      </div>
      {receipt ? (
        <ProposalExecutionReceiptDetails
          blockExplorerUrl={blockExplorerUrl}
          managedExecutorAddress={managedExecutorAddress}
          receipt={receipt}
        />
      ) : (
        <dl className="technical-detail-grid proposal-execution-receipt-grid">
          <TechDetail
            label="Execution mode"
            value={executionMode ? formatLabel(executionMode) : "Not reported"}
          />
          <TechDetail
            label="Managed executor"
            value={
              executionMode === ProposalExecutionMode.Managed
                ? managedExecutorAddress ?? "Not reported"
                : "Direct execution"
            }
            mono={
              executionMode === ProposalExecutionMode.Managed &&
              Boolean(managedExecutorAddress)
            }
          />
          <TechDetail label="Receipt" value="Not indexed" />
        </dl>
      )}
    </section>
  );
}

function ProposalExecutionReceiptDetails({
  blockExplorerUrl,
  managedExecutorAddress,
  receipt,
}: {
  readonly blockExplorerUrl?: string;
  readonly managedExecutorAddress?: string;
  readonly receipt: ProposalExecutionReceiptDto;
}): JSX.Element {
  return (
    <dl className="technical-detail-grid proposal-execution-receipt-grid">
      <TechDetail
        label="Execution mode"
        value={formatLabel(receipt.executionMode)}
      />
      <TechDetail label="Executed by" value={receipt.executorAddress} mono />
      <TechDetail
        label="Final target address"
        value={receipt.targetAddress}
        mono
      />
      <TechDetail
        label="Final value"
        value={formatValueLimit(receipt.value)}
        mono
      />
      <TechDetail
        label="Final action selector"
        value={receipt.actionSelector}
        mono
      />
      <TechDetail label="Final data hash" value={receipt.dataHash} mono />
      <TechDetail
        label="Managed executor"
        value={
          receipt.executionMode === ProposalExecutionMode.Managed
            ? managedExecutorAddress ?? "Not reported"
            : "Direct execution"
        }
        mono={
          receipt.executionMode === ProposalExecutionMode.Managed &&
          Boolean(managedExecutorAddress)
        }
      />
      <TechDetail
        label="Execution tx"
        value={
          receipt.transactionHash ? (
            <IsoTransactionHash
              blockExplorerUrl={blockExplorerUrl}
              txHash={receipt.transactionHash}
            />
          ) : (
            "Not reported"
          )
        }
      />
      <TechDetail
        label="Execution block"
        value={receipt.blockNumber ?? "Not reported"}
        mono
      />
      <TechDetail
        label="Observed timestamp"
        value={formatIsoDateTime(receipt.observedAt)}
      />
    </dl>
  );
}

function ExecutionPermissionNotice({
  permissions,
  permissionsError,
  proposal,
}: {
  readonly permissions?: OrganizationExecutionPermissionsDto;
  readonly permissionsError?: Error;
  readonly proposal: ProposalDto;
}): JSX.Element | null {
  const identity = getPermissionActionIdentity(proposal);

  if (!identity.targetAddress) {
    return null;
  }

  const notice = getExecutionPermissionNotice({
    identity,
    permissions,
    permissionsError,
  });

  return (
    <section
      className={`product-card product-card-wide execution-permission-proposal-notice execution-permission-proposal-notice-${notice.tone}`}
    >
      <div className="product-card-header">
        <div>
          <h2>Execution Permission Check</h2>
          <p>
            Read-only comparison against the organization execution permission
            registry. The comparison stays on final target, value, and
            protocol-declared action selector; managed executor address is not
            the permission target.
          </p>
        </div>
        <IsoStatusPill tone={notice.tone}>{notice.label}</IsoStatusPill>
      </div>
      <div className={`inline-state inline-state-${notice.inlineTone}`}>
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
      <dl className="technical-detail-grid">
        <TechDetail
          label="Proposal target"
          value={identity.targetAddress}
          mono
        />
        <TechDetail
          label="Proposal value"
          value={formatValueLimit(identity.value)}
          mono
        />
        <TechDetail
          label="Proposal action selector"
          value={identity.actionSelector ?? "Legacy/unavailable"}
          mono
        />
        <TechDetail
          label="Managed executor"
          value={
            proposal.managedExecutorAddress ??
            proposal.executionReceipt?.managedExecutorAddress ??
            "Not part of permission comparison"
          }
          mono={Boolean(
            proposal.managedExecutorAddress ??
              proposal.executionReceipt?.managedExecutorAddress,
          )}
        />
        <TechDetail
          label="Registry target"
          value={notice.target ? notice.target.targetAddress : "Not returned"}
          mono
        />
        <TechDetail
          label="Registry value limit"
          value={
            notice.target ? formatValueLimit(notice.target.maxValue) : "Unknown"
          }
          mono
        />
        <TechDetail
          label="Registry selector"
          value={
            notice.selector
              ? notice.selector.selector
              : notice.target
                ? "Not returned"
                : "Unknown"
          }
          mono
        />
        <TechDetail
          label="Registry selector state"
          value={
            notice.selector
              ? notice.selector.enabled
                ? "Enabled"
                : "Disabled"
              : notice.target
                ? "Not configured"
                : "Unknown"
          }
        />
        <TechDetail
          label="Selector coverage"
          value={
            notice.target
              ? `${notice.target.selectors.length.toLocaleString()} selector rules returned`
              : "Unknown"
          }
        />
        <TechDetail
          label="Registry route"
          value={
            <Link
              className="diagnostics-text-link"
              to={`/orgs/${proposal.orgId}/execution-permissions`}
            >
              Open execution permissions
            </Link>
          }
        />
        <TechDetail label="Comparison basis" value={identity.source} />
      </dl>
    </section>
  );
}

function NextActionCard({
  bodies,
  proposal,
  route,
  routeError,
}: {
  readonly bodies: readonly BodyDto[];
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): JSX.Element {
  const action = getProposalNextActionContext({
    bodies,
    proposal,
    route,
    routeError,
  });

  return (
    <section className="context-card">
      <div className="context-card-header context-card-header-row">
        <h2>Next Action</h2>
        <IsoStatusPill tone={action.tone}>{action.label}</IsoStatusPill>
      </div>
      <div className="next-action-copy">
        <strong>{action.title}</strong>
        <span>{action.detail}</span>
      </div>
      <dl className="context-detail-list">
        <InfoRow label="Who can act" value={action.actor} />
        <InfoRow
          label="Connected wallet"
          value="Authority is checked by the contract when submitting."
        />
      </dl>
    </section>
  );
}

function ProposalTechnicalTab({
  bodies,
  blockExplorerUrl,
  proposal,
  route,
  routeError,
}: {
  readonly bodies: readonly BodyDto[];
  readonly blockExplorerUrl?: string;
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): JSX.Element {
  return (
    <div className="proposal-technical-stack">
      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Raw Proposal Fields</h2>
            <p>Technical values from the proposal read model.</p>
          </div>
        </div>
        <dl className="technical-detail-grid">
          <TechDetail label="Chain ID" value={String(proposal.chainId)} />
          <TechDetail label="Org ID" value={proposal.orgId} />
          <TechDetail label="Proposal ID" value={proposal.proposalId} />
          <TechDetail
            label="Proposal type"
            value={formatLabel(proposal.proposalType)}
          />
          <TechDetail label="Status" value={formatLabel(proposal.status)} />
          <TechDetail
            label="Policy version"
            value={`v${proposal.policyVersion}`}
          />
          <TechDetail label="Creator" value={proposal.creatorAddress} mono />
          <TechDetail
            label="Target"
            value={proposal.targetAddress ?? "No target address"}
            mono
          />
          <TechDetail label="Value" value={proposal.value} mono />
          <TechDetail
            label="Protocol-declared action selector"
            value={formatProposalActionSelector(proposal)}
            mono
          />
          <TechDetail
            label="Execution mode"
            value={
              proposal.executionMode
                ? formatLabel(proposal.executionMode)
                : "Not reported"
            }
          />
          <TechDetail
            label="Managed executor"
            value={proposal.managedExecutorAddress ?? "Not reported"}
            mono={Boolean(proposal.managedExecutorAddress)}
          />
          <TechDetail label="Created block" value={proposal.createdBlock} mono />
          <TechDetail
            label="Created tx"
            value={
              <IsoTransactionHash
                blockExplorerUrl={blockExplorerUrl}
                txHash={proposal.createdTxHash}
              />
            }
          />
          <TechDetail
            label="Created chain time"
            value={proposal.createdAtChain}
            mono
          />
          <TechDetail
            label="Queued chain time"
            value={proposal.queuedAtChain ?? "Not set"}
            mono
          />
          <TechDetail
            label="Executable chain time"
            value={proposal.executableAtChain ?? "Not set"}
            mono
          />
          <TechDetail
            label="Executed chain time"
            value={proposal.executedAtChain ?? "Not set"}
            mono
          />
          <TechDetail
            label="Data status"
            value={proposal.dataStatus ? formatLabel(proposal.dataStatus) : "Observed"}
          />
          <TechDetail
            label="Data hash"
            value={proposal.dataHash ?? "No data hash indexed"}
            mono
          />
          <TechDetail
            label="Description URI"
            value={proposal.descriptionUri ?? "No metadata URI indexed"}
            mono
          />
        </dl>
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Route Technical Identifiers</h2>
            <p>Stable identifiers from the route explanation response.</p>
          </div>
        </div>
        {route ? (
          <dl className="technical-detail-grid">
            <TechDetail label="Route chain ID" value={String(route.chainId)} />
            <TechDetail label="Route org ID" value={route.orgId} />
            <TechDetail label="Route proposal ID" value={route.proposalId} />
            <TechDetail
              label="Route proposal type"
              value={formatLabel(route.proposalType)}
            />
            <TechDetail
              label="Route status"
              value={formatLabel(route.status)}
            />
            <TechDetail
              label="Executor body"
              value={
                route.execution.executorBody
                  ? getExecutorBodyLabel({
                      bodies,
                      bodyId: route.execution.executorBody,
                      route,
                    })
                  : "Not reported"
              }
            />
            <TechDetail
              label="Blocked reason codes"
              value={
                route.execution.blockedReasons
                  .map((reason) => reason.code)
                  .join(", ") || "None"
              }
              mono
            />
          </dl>
        ) : (
          <CalmState
            title="Route details unavailable"
            message={
              routeError?.message ??
              "The proposal loaded, but route technical identifiers are unavailable."
            }
          />
        )}
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Raw DTO Snapshots</h2>
            <p>Debug payloads are kept here instead of the default view.</p>
          </div>
        </div>
        <details className="technical-disclosure">
          <summary>Proposal DTO</summary>
          <pre>{JSON.stringify(proposal, null, 2)}</pre>
        </details>
        {route ? (
          <details className="technical-disclosure">
            <summary>Route DTO</summary>
            <pre>{JSON.stringify(route, null, 2)}</pre>
          </details>
        ) : null}
        {proposal.executionReceipt ? (
          <details className="technical-disclosure">
            <summary>Execution Receipt DTO</summary>
            <pre>{JSON.stringify(proposal.executionReceipt, null, 2)}</pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function RouteOverviewCards({
  bodies,
  proposal,
  route,
  routeError,
}: {
  readonly bodies: readonly BodyDto[];
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): JSX.Element {
  if (!route) {
    return (
      <CalmState
        title="Route unavailable"
        message={
          routeError?.message ??
          `Route explanation is not available for proposal #${proposal.proposalId}.`
        }
      />
    );
  }

  const approvals = route.requiredApprovalBodies;
  const approvedCount = approvals.filter((body) => body.approved).length;
  const vetoes = route.vetoBodies;
  const vetoedCount = vetoes.filter((body) => body.vetoed).length;
  const nextAction = getProposalNextActionContext({
    bodies,
    proposal,
    route,
    routeError: undefined,
  });

  return (
    <div className="proposal-route-metric-grid">
      <MetricCard
        detail={
          approvals.length === 0
            ? "No required approval bodies"
            : "Required bodies approved"
        }
        label="Approvals"
        value={`${approvedCount}/${approvals.length}`}
      />
      <MetricCard
        detail={
          vetoes.length === 0
            ? "No veto bodies configured"
            : vetoedCount > 0
              ? "A veto has been recorded"
              : "No veto recorded"
        }
        label="Veto"
        tone={vetoedCount > 0 ? "danger" : "success"}
        value={vetoes.length === 0 ? "None" : `${vetoedCount}/${vetoes.length}`}
      />
      <MetricCard
        detail={
          route.timelock.required
            ? route.timelock.satisfied
              ? "Timelock satisfied"
              : "Waiting for queue delay"
            : "No queue delay configured"
        }
        label="Timelock"
        tone={
          route.timelock.required && !route.timelock.satisfied
            ? "warning"
            : "muted"
        }
        value={route.timelock.required ? "Required" : "None"}
      />
      <MetricCard
        detail={nextAction.detail}
        label={getRouteOverviewMetricLabel(proposal.status)}
        tone={nextAction.tone}
        value={nextAction.label}
      />
    </div>
  );
}

function ProposalLifecycleTimeline({
  proposal,
}: {
  readonly proposal: ProposalDto;
}): JSX.Element {
  const items = [
    {
      detail: formatChainTime(proposal.createdAtChain),
      label: "Created",
      tone: "success",
    },
    {
      detail: proposal.queuedAtChain
        ? formatChainTime(proposal.queuedAtChain)
        : "Not queued",
      label: "Queued",
      tone: proposal.queuedAtChain ? "success" : "muted",
    },
    {
      detail: proposal.executableAtChain
        ? formatChainTime(proposal.executableAtChain)
        : "Not available",
      label: "Executable",
      tone: proposal.executableAtChain ? "success" : "muted",
    },
    {
      detail: proposal.executedAtChain
        ? formatChainTime(proposal.executedAtChain)
        : "Not executed",
      label: "Executed",
      tone:
        proposal.status === ProposalStatus.Executed ? "success" : "muted",
    },
  ] satisfies readonly {
    readonly detail: string;
    readonly label: string;
    readonly tone: IsoStatusPillTone;
  }[];

  return (
    <ol className="proposal-timeline">
      {items.map((item) => (
        <li className={`proposal-timeline-item proposal-timeline-${item.tone}`} key={item.label}>
          <span className="proposal-timeline-marker" aria-hidden="true" />
          <div>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LifecyclePills({
  proposal,
}: {
  readonly proposal: ProposalDto;
}): JSX.Element {
  return (
    <>
      <IsoStatusPill tone="success">Created</IsoStatusPill>
      {proposal.queuedAtChain ? (
        <IsoStatusPill tone="success">Queued</IsoStatusPill>
      ) : null}
      {proposal.executableAtChain ? (
        <IsoStatusPill tone="warning">Executable</IsoStatusPill>
      ) : null}
      {proposal.executedAtChain ? (
        <IsoStatusPill tone="success">Executed</IsoStatusPill>
      ) : null}
    </>
  );
}

function MetricCard({
  detail,
  label,
  tone = "muted",
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly tone?: IsoStatusPillTone;
  readonly value: string;
}): JSX.Element {
  return (
    <div className={`proposal-metric-card proposal-metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Fact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TechDetail({
  label,
  mono,
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

function CalmState({
  message,
  title,
}: {
  readonly message: string;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="calm-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

async function loadProposalRoute(
  client: IsoniaControlPlaneClient,
  orgId: string,
  proposalId: string,
): Promise<RouteLoadResult> {
  try {
    return {
      route: await client.getProposalRoute(orgId, proposalId),
      routeError: undefined,
    };
  } catch (error: unknown) {
    return {
      route: undefined,
      routeError: toError(error),
    };
  }
}

async function loadExecutionPermissions(
  client: IsoniaControlPlaneClient,
  orgId: string,
): Promise<ExecutionPermissionsLoadResult> {
  try {
    return {
      executionPermissions: await client.executionPermissions.get(orgId),
      executionPermissionsError: undefined,
    };
  } catch (error: unknown) {
    return {
      executionPermissions: undefined,
      executionPermissionsError: toExecutionPermissionsError(error),
    };
  }
}

function hasDisplayValue(value?: string): boolean {
  return value !== undefined && value.trim().length > 0;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Route explanation data is unavailable.");
}

function toExecutionPermissionsError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Execution permission data is unavailable.");
}

function formatValueLimit(value: string | undefined): string {
  const formatted = formatNumericString(value);
  return formatted === "Not set" ? formatted : `${formatted} wei`;
}

function formatProposalActionSelector(proposal: ProposalDto): string {
  return proposal.actionSelector ?? "Legacy/unavailable";
}
