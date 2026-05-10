import type {
  BodyDto,
  ProposalDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
  RoleDto,
} from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useRuntimeConfig } from "../../config/runtime-config";
import { type MetadataState, useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import {
  IsoStatusPill,
  IsoTabs,
  IsoTransactionHash,
  type IsoStatusPillTone,
} from "../../ui-kit";
import { proposalDisplay } from "../../utils/display-labels";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
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
import {
  formatRouteBlockedReasonMessage,
  getExecutorBodyLabel,
  getRelatedRouteBodyLabel,
} from "./proposal-body-labels";

interface ProposalDetailsData {
  readonly bodies: readonly BodyDto[];
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

export function ProposalDetailsPage(): JSX.Element {
  const client = useIsoniaClient();
  const params = useParams();
  const orgId = requireParam(params.orgId, "orgId");
  const proposalId = requireParam(params.proposalId, "proposalId");
  const details = useIsoniaQuery(
    async (): Promise<ProposalDetailsData> => {
      const [proposal, routeResult, overview, bodies, roles] = await Promise.all([
        client.getProposal(orgId, proposalId),
        loadProposalRoute(client, orgId, proposalId),
        client.getOrganizationOverview(orgId),
        client.getBodies(orgId),
        client.getRoles(orgId),
      ]);
      return {
        bodies,
        orgAdminAddress: overview.organization.adminAddress,
        proposal,
        roles,
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
        {({ bodies, orgAdminAddress, proposal, roles, route, routeError }) => (
          <ProposalDetailsContent
            bodies={bodies}
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

  return (
    <>
      <header className="proposal-detail-header">
        <nav className="proposal-breadcrumb" aria-label="Proposal breadcrumb">
          <Link to={`/orgs/${orgId}/proposals`}>Proposals</Link>
          <span aria-hidden="true">/</span>
          <span>Proposal #{proposal.proposalId}</span>
        </nav>
        <div className="proposal-detail-header-main">
          <div className="proposal-detail-title-block">
            <h1>{proposalText.title}</h1>
            <p>{headerDescription}</p>
            <div className="proposal-status-row">
              <IsoStatusPill tone={statusTone(proposal.status)}>
                {formatLabel(proposal.status)}
              </IsoStatusPill>
              <IsoStatusPill tone={routeReadinessTone(route, routeError)}>
                {routeReadinessLabel(route, routeError)}
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
                    bodies={bodies}
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
                  <ProposalActionsPanel
                    bodies={bodies}
                    busy={proposalAction.busy}
                    demoExecution={demoExecution}
                    demoNumber={demoNumber}
                    onDemoNumberChange={setDemoNumber}
                    orgAdminAddress={orgAdminAddress}
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
  bodies,
  metadata,
  proposal,
  route,
  routeError,
}: {
  readonly bodies: readonly BodyDto[];
  readonly metadata: MetadataState;
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): JSX.Element {
  const hasMetadataUri = hasDisplayValue(proposal.descriptionUri);
  const metadataMissing = !hasMetadataUri;
  const metadataUnavailable =
    hasMetadataUri && !metadata.loading && !metadata.record;

  return (
    <div className="proposal-overview-grid">
      <section className="product-card proposal-summary-card">
        <div className="product-card-header">
          <div>
            <h2>Proposal Summary</h2>
            <p>Human-readable state from indexed proposal data.</p>
          </div>
          <IsoStatusPill tone={statusTone(proposal.status)}>
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

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Lifecycle</h2>
            <p>Current indexed lifecycle milestones.</p>
          </div>
        </div>
        <ProposalLifecycleTimeline proposal={proposal} />
      </section>

      <section className="product-card product-card-wide">
        <div className="product-card-header">
          <div>
            <h2>Route Snapshot</h2>
            <p>Approval, veto, timelock, and execution readiness.</p>
          </div>
          <IsoStatusPill tone={routeReadinessTone(route, routeError)}>
            {routeReadinessLabel(route, routeError)}
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
  const action = getNextActionContext(proposal, route, routeError, bodies);

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
  const nextAction = getNextActionContext(proposal, route, undefined, bodies);

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
        label="Next blocker"
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

function getNextActionContext(
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
  bodies: readonly BodyDto[],
): {
  readonly actor: string;
  readonly detail: string;
  readonly label: string;
  readonly title: string;
  readonly tone: IsoStatusPillTone;
} {
  if (proposal.status === ProposalStatus.Executed) {
    return {
      actor: "No further action",
      detail: "The indexed proposal lifecycle is complete.",
      label: "Complete",
      title: "Proposal executed",
      tone: "success",
    };
  }

  if (
    proposal.status === ProposalStatus.Cancelled ||
    proposal.status === ProposalStatus.Expired ||
    proposal.status === ProposalStatus.Vetoed
  ) {
    return {
      actor: "No standard action",
      detail: `Proposal is ${formatLabel(proposal.status)}.`,
      label: formatLabel(proposal.status),
      title: "Proposal is final",
      tone: "danger",
    };
  }

  if (!route) {
    return {
      actor: "Route endpoint",
      detail:
        routeError?.message ??
        "Approval, veto, timelock, and execution readiness need route data.",
      label: "Unknown",
      title: "Route state unavailable",
      tone: "warning",
    };
  }

  if (route.execution.executable) {
    return {
      actor: route.execution.executorBody
        ? getExecutorBodyLabel({
            bodies,
            bodyId: route.execution.executorBody,
            route,
          })
        : "Configured executor body",
      detail: "Approvals, veto checks, and timelock state allow execution.",
      label: "Execute",
      title: "Ready for execution",
      tone: "success",
    };
  }

  const firstReason = route.execution.blockedReasons[0];

  if (!firstReason) {
    return {
      actor: "Governance route",
      detail:
        "Execution is false, but the route explainer did not report a blocker.",
      label: "Check route",
      title: "Route needs review",
      tone: "warning",
    };
  }

  return contextFromBlockedReason(firstReason, route, bodies);
}

function contextFromBlockedReason(
  reason: RouteBlockedReasonDto,
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): {
  readonly actor: string;
  readonly detail: string;
  readonly label: string;
  readonly title: string;
  readonly tone: IsoStatusPillTone;
} {
  if (reason.code === "missing_approval") {
    return {
      actor: reason.relatedBodyId
        ? getRelatedRouteBodyLabel({
            bodies,
            bodyId: reason.relatedBodyId,
            route,
            role: "Approver",
          })
        : "Required approval body",
      detail: formatRouteBlockedReasonMessage({
        bodies,
        reason,
        role: "Approver",
        route,
      }),
      label: "Approval",
      title: "Approval needed",
      tone: "warning",
    };
  }

  if (reason.code === "not_queued") {
    return {
      actor: "Any authorized queue caller",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Queue",
      title: "Queue needed",
      tone: "warning",
    };
  }

  if (reason.code === "timelock_not_satisfied") {
    return {
      actor: "No one yet",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Waiting",
      title: "Timelock active",
      tone: "warning",
    };
  }

  if (reason.code === "vetoed") {
    return {
      actor: "No standard action",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Vetoed",
      title: "Execution blocked",
      tone: "danger",
    };
  }

  if (reason.code === "policy_snapshot_missing") {
    return {
      actor: "Indexer/projection recovery",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Snapshot",
      title: "Policy snapshot missing",
      tone: "danger",
    };
  }

  return {
    actor: reason.relatedBodyId
      ? getRelatedRouteBodyLabel({
          bodies,
          bodyId: reason.relatedBodyId,
          route,
        })
      : "Governance route",
    detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
    label: "Blocked",
    title: formatLabel(reason.code),
    tone: ["already_executed", "cancelled", "expired"].includes(reason.code)
      ? "danger"
      : "warning",
  };
}

function statusTone(status: ProposalStatus): IsoStatusPillTone {
  if (status === ProposalStatus.Executed || status === ProposalStatus.Approved) {
    return "success";
  }

  if (
    status === ProposalStatus.Cancelled ||
    status === ProposalStatus.Expired ||
    status === ProposalStatus.Vetoed
  ) {
    return "danger";
  }

  if (status === ProposalStatus.Queued || status === ProposalStatus.UnderReview) {
    return "warning";
  }

  return "default";
}

function routeReadinessTone(
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
): IsoStatusPillTone {
  if (!route) {
    return routeError ? "warning" : "muted";
  }

  if (route.execution.executable) {
    return "success";
  }

  return route.execution.blockedReasons.some((reason) =>
    ["vetoed", "already_executed", "cancelled", "expired"].includes(
      reason.code,
    ),
  )
    ? "danger"
    : "warning";
}

function routeReadinessLabel(
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
): string {
  if (!route) {
    return routeError ? "Route unavailable" : "Route pending";
  }

  return route.execution.executable ? "Route ready" : "Route blocked";
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

function hasDisplayValue(value?: string): boolean {
  return value !== undefined && value.trim().length > 0;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Route explanation data is unavailable.");
}
