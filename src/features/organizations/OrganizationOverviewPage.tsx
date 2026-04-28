import type { OrganizationOverviewDto } from "@isonia/types";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import {
  organizationDisplay,
  proposalDisplay,
} from "../../utils/display-labels";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
} from "../../utils/format";
import { requireParam } from "../../utils/route-params";

export function OrganizationOverviewPage(): JSX.Element {
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
        loadingTitle="Loading organization"
        loadingMessage="Reading overview, counts, and latest proposals."
        emptyTitle="Organization not found"
        emptyMessage={`No indexed organization was found for org #${orgId}.`}
        errorTitle="Unable to load organization"
      >
        {(data) => (
          <OrganizationOverviewContent data={data} orgId={orgId} />
        )}
      </AsyncContent>
    </section>
  );
}

function OrganizationOverviewContent({
  data,
  orgId,
}: {
  readonly data: OrganizationOverviewDto;
  readonly orgId: string;
}): JSX.Element {
  const metadata = useMetadata(data.organization.metadataUri);
  const display = organizationDisplay(data.organization, metadata.record);

  return (
    <>
      <PageHeader
        eyebrow={display.subtitle ?? `Organization #${data.organization.orgId}`}
        title={display.title}
        description={display.description ?? data.organization.slug}
      />

      <div className="metric-grid">
        <div className="metric">
          <span>Bodies</span>
          <strong>{data.counts.bodies}</strong>
        </div>
        <div className="metric">
          <span>Roles</span>
          <strong>{data.counts.roles}</strong>
        </div>
        <div className="metric">
          <span>Active mandates</span>
          <strong>{data.counts.activeMandates}</strong>
        </div>
        <div className="metric">
          <span>Active proposals</span>
          <strong>{data.counts.activeProposals}</strong>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Organization</h2>
          <StatusBadge>{formatLabel(data.organization.status)}</StatusBadge>
        </div>
        <dl className="detail-list detail-list-wide">
          <div>
            <dt>Admin</dt>
            <dd>{formatAddress(data.organization.adminAddress)}</dd>
          </div>
          <div>
            <dt>Created block</dt>
            <dd>{data.organization.createdBlock}</dd>
          </div>
          <div>
            <dt>Created tx</dt>
            <dd>{formatAddress(data.organization.createdTxHash)}</dd>
          </div>
          <div>
            <dt>Metadata URI</dt>
            <dd className="mono-value">
              {data.organization.metadataUri ?? "No metadata URI indexed"}
            </dd>
          </div>
          <div>
            <dt>Data status</dt>
            <dd>
              <DataStatusBadge status={data.organization.dataStatus} />
            </dd>
          </div>
        </dl>
      </section>

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}/governance`}>
          Governance
        </Link>
        <Link className="button" to={`/orgs/${orgId}/proposals`}>
          Proposals
        </Link>
        <Link className="button" to={`/orgs/${orgId}/graph`}>
          Graph
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Latest proposals</h2>
        </div>
        {data.latestProposals.length === 0 ? (
          <div className="inline-state inline-state-muted">
            <strong>No proposals indexed</strong>
            <span>
              This organization has no proposals in the current read model.
            </span>
          </div>
        ) : (
          <div className="list-stack">
            {data.latestProposals.map((proposal) => {
              const proposalText = proposalDisplay(proposal, undefined);
              return (
                <Link
                  className="list-row list-row-link"
                  to={`/orgs/${orgId}/proposals/${proposal.proposalId}`}
                  key={proposal.proposalId}
                >
                  <div>
                    <strong>{proposalText.title}</strong>
                    <span>
                      {proposalText.subtitle} -{" "}
                      {formatChainTime(proposal.createdAtChain)}
                    </span>
                  </div>
                  <StatusBadge>{formatLabel(proposal.status)}</StatusBadge>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
