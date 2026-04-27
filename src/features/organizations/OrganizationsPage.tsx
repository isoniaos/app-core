import { Link } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import { formatAddress, formatLabel } from "../../utils/format";

export function OrganizationsPage(): JSX.Element {
  const client = useIsoniaClient();
  const organizations = useIsoniaQuery(() => client.getOrganizations(), [
    client,
  ]);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Control Plane"
        title="Organizations"
        description="Governance organizations indexed from the shared protocol."
      />
      <AsyncContent
        state={organizations}
        isEmpty={(data) => data.length === 0}
      >
        {(data) => (
          <section className="panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Admin</th>
                    <th>Chain</th>
                    <th>Data</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((organization) => (
                    <tr key={organization.orgId}>
                      <td>
                        <strong>{organization.name}</strong>
                        <span className="table-subtext">
                          Org #{organization.orgId}
                        </span>
                      </td>
                      <td>
                        <StatusBadge>
                          {formatLabel(organization.status)}
                        </StatusBadge>
                      </td>
                      <td>{formatAddress(organization.adminAddress)}</td>
                      <td>{organization.chainId}</td>
                      <td>
                        <DataStatusBadge status={organization.dataStatus} />
                      </td>
                      <td className="table-action">
                        <Link
                          className="button button-small"
                          to={`/orgs/${organization.orgId}`}
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

