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

export function ProposalsPage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const proposals = useIsoniaQuery(() => client.getProposals(orgId), [
    client,
    orgId,
  ]);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Proposals"
        description="Proposal lifecycle state and policy snapshots."
      />
      <AsyncContent state={proposals} isEmpty={(data) => data.length === 0}>
        {(data) => (
          <section className="panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Policy</th>
                    <th>Creator</th>
                    <th>Created</th>
                    <th>Data</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((proposal) => (
                    <tr key={proposal.proposalId}>
                      <td>
                        <strong>{proposal.title}</strong>
                        <span className="table-subtext">
                          Proposal #{proposal.proposalId}
                        </span>
                      </td>
                      <td>{formatLabel(proposal.proposalType)}</td>
                      <td>
                        <StatusBadge>{formatLabel(proposal.status)}</StatusBadge>
                      </td>
                      <td>v{proposal.policyVersion}</td>
                      <td>{formatAddress(proposal.creatorAddress)}</td>
                      <td>{formatChainTime(proposal.createdAtChain)}</td>
                      <td>
                        <DataStatusBadge status={proposal.dataStatus} />
                      </td>
                      <td className="table-action">
                        <Link
                          className="button button-small"
                          to={`/orgs/${orgId}/proposals/${proposal.proposalId}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </AsyncContent>
    </section>
  );
}

