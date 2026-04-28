import type {
  ProposalDto,
  ProposalRouteExplanationDto,
} from "@isonia/types";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import { proposalDisplay } from "../../utils/display-labels";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
} from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import {
  RouteExplanationPanel,
  type RouteFallbackContext,
} from "./RouteExplanationPanel";

interface ProposalDetailsData {
  readonly proposal: ProposalDto;
  readonly route: ProposalRouteExplanationDto | undefined;
  readonly routeError: Error | undefined;
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
      const [proposal, routeResult] = await Promise.all([
        client.getProposal(orgId, proposalId),
        loadProposalRoute(client, orgId, proposalId),
      ]);
      return { proposal, ...routeResult };
    },
    [client, orgId, proposalId],
  );
  const metadata = useMetadata(details.data?.proposal.descriptionUri);

  return (
    <section className="page-stack">
      <AsyncContent
        state={details}
        loadingTitle="Loading proposal"
        loadingMessage="Reading proposal details and route explanation."
        emptyTitle="Proposal not found"
        emptyMessage={`No indexed proposal #${proposalId} was found for org #${orgId}.`}
        errorTitle="Unable to load proposal"
      >
        {({ proposal, route, routeError }) => {
          const proposalText = proposalDisplay(proposal, metadata.record);
          const hasMetadataUri = hasDisplayValue(proposal.descriptionUri);
          const routeFallback: RouteFallbackContext = {
            chainId: proposal.chainId,
            orgId: proposal.orgId,
            proposalId: proposal.proposalId,
            proposalType: proposal.proposalType,
            policyVersion: proposal.policyVersion,
            status: proposal.status,
          };

          return (
            <>
              <PageHeader
                eyebrow={`Proposal #${proposal.proposalId}`}
                title={proposalText.title}
                description={
                  proposalText.description ??
                  `${formatLabel(
                    proposal.proposalType,
                  )} proposal - policy snapshot v${proposal.policyVersion}`
                }
              />

              <div className="action-row">
                <Link className="button" to={`/orgs/${orgId}/proposals`}>
                  Back to proposals
                </Link>
              </div>

              <section className="panel">
                <div className="panel-header">
                  <h2>Proposal</h2>
                  <div className="chip-row">
                    <StatusBadge tone="muted">
                      Policy v{proposal.policyVersion}
                    </StatusBadge>
                    <StatusBadge>{formatLabel(proposal.status)}</StatusBadge>
                  </div>
                </div>
                <dl className="detail-list detail-list-wide">
                  <div>
                    <dt>Type</dt>
                    <dd>{formatLabel(proposal.proposalType)}</dd>
                  </div>
                  <div>
                    <dt>Policy version</dt>
                    <dd>Snapshot v{proposal.policyVersion}</dd>
                  </div>
                  <div>
                    <dt>Creator</dt>
                    <dd>{formatAddress(proposal.creatorAddress)}</dd>
                  </div>
                  <div>
                    <dt>Target</dt>
                    <dd>
                      {proposal.targetAddress
                        ? formatAddress(proposal.targetAddress)
                        : "No target address"}
                    </dd>
                  </div>
                  <div>
                    <dt>Value</dt>
                    <dd>{proposal.value}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatChainTime(proposal.createdAtChain)}</dd>
                  </div>
                  <div>
                    <dt>Executable</dt>
                    <dd>
                      {proposal.executableAtChain
                        ? formatChainTime(proposal.executableAtChain)
                        : "Not queued"}
                    </dd>
                  </div>
                  <div>
                    <dt>Data status</dt>
                    <dd>
                      <DataStatusBadge status={proposal.dataStatus} />
                    </dd>
                  </div>
                  <div>
                    <dt>Data hash</dt>
                    <dd className="mono-value">
                      {proposal.dataHash ?? "No data hash indexed"}
                    </dd>
                  </div>
                  <div>
                    <dt>Description URI</dt>
                    <dd className="mono-value">
                      {proposal.descriptionUri ?? "No metadata URI indexed"}
                    </dd>
                  </div>
                </dl>
                {!hasMetadataUri ? (
                  <div className="inline-state inline-state-muted">
                    <strong>Missing metadata</strong>
                    <span>
                      No proposal metadata URI was indexed, so this screen is
                      showing chain-derived fallback fields.
                    </span>
                  </div>
                ) : !metadata.loading && !metadata.record ? (
                  <div className="inline-state inline-state-muted">
                    <strong>Metadata unavailable</strong>
                    <span>
                      The metadata URI could not be resolved, so this screen is
                      using proposal type and chain-derived identifiers.
                    </span>
                  </div>
                ) : null}
              </section>

              <RouteExplanationPanel
                fallback={routeFallback}
                route={route}
                routeError={routeError}
              />
            </>
          );
        }}
      </AsyncContent>
    </section>
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

function hasDisplayValue(value?: string): boolean {
  return value !== undefined && value.trim().length > 0;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Route explanation data is unavailable.");
}
