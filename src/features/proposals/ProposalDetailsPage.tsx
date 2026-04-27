import type {
  ProposalDto,
  ProposalRouteExplanationDto,
} from "@isonia/types";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
} from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { RouteExplanationPanel } from "./RouteExplanationPanel";

interface ProposalDetailsData {
  readonly proposal: ProposalDto;
  readonly route: ProposalRouteExplanationDto;
}

export function ProposalDetailsPage(): JSX.Element {
  const client = useIsoniaClient();
  const params = useParams();
  const orgId = requireParam(params.orgId, "orgId");
  const proposalId = requireParam(params.proposalId, "proposalId");
  const details = useIsoniaQuery(
    async (): Promise<ProposalDetailsData> => {
      const [proposal, route] = await Promise.all([
        client.getProposal(orgId, proposalId),
        client.getProposalRoute(orgId, proposalId),
      ]);
      return { proposal, route };
    },
    [client, orgId, proposalId],
  );

  return (
    <section className="page-stack">
      <AsyncContent state={details}>
        {({ proposal, route }) => (
          <>
            <PageHeader
              eyebrow={`Proposal #${proposal.proposalId}`}
              title={proposal.title}
              description={`${formatLabel(proposal.proposalType)} - policy v${proposal.policyVersion}`}
            />

            <div className="action-row">
              <Link className="button" to={`/orgs/${orgId}/proposals`}>
                Back to proposals
              </Link>
            </div>

            <section className="panel">
              <div className="panel-header">
                <h2>Proposal</h2>
                <StatusBadge>{formatLabel(proposal.status)}</StatusBadge>
              </div>
              <dl className="detail-list detail-list-wide">
                <div>
                  <dt>Creator</dt>
                  <dd>{formatAddress(proposal.creatorAddress)}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>
                    {proposal.targetAddress
                      ? formatAddress(proposal.targetAddress)
                      : "None"}
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
                {proposal.dataHash ? (
                  <div>
                    <dt>Data hash</dt>
                    <dd className="mono-value">{proposal.dataHash}</dd>
                  </div>
                ) : null}
                {proposal.descriptionUri ? (
                  <div>
                    <dt>Description URI</dt>
                    <dd className="mono-value">{proposal.descriptionUri}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <RouteExplanationPanel route={route} />
          </>
        )}
      </AsyncContent>
    </section>
  );
}

