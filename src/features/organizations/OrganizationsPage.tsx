import type { OrganizationDto } from "@isonia/types";
import { Link } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import { organizationDisplay } from "../../utils/display-labels";
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
      <div className="action-row">
        <Link className="button button-primary" to="/orgs/new">
          New organization
        </Link>
      </div>
      <AsyncContent
        state={organizations}
        isEmpty={(data) => data.length === 0}
        loadingTitle="Loading organizations"
        loadingMessage="Reading organizations from the control-plane index."
        emptyTitle="No organizations indexed"
        emptyMessage="Seed or create an organization, then run the indexer and projection worker."
        errorTitle="Unable to load organizations"
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
                    <OrganizationRow
                      key={organization.orgId}
                      organization={organization}
                    />
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

function OrganizationRow({
  organization,
}: {
  readonly organization: OrganizationDto;
}): JSX.Element {
  const metadata = useMetadata(organization.metadataUri);
  const display = organizationDisplay(organization, metadata.record);

  return (
    <tr>
      <td>
        <strong>{display.title}</strong>
        <span className="table-subtext">
          {display.subtitle}
          {display.description ? ` - ${display.description}` : ""}
        </span>
      </td>
      <td>
        <StatusBadge>{formatLabel(organization.status)}</StatusBadge>
      </td>
      <td>{formatAddress(organization.adminAddress)}</td>
      <td>{organization.chainId}</td>
      <td>
        <DataStatusBadge status={organization.dataStatus} />
      </td>
      <td className="table-action">
        <Link className="button button-small" to={`/orgs/${organization.orgId}`}>
          Open
        </Link>
      </td>
    </tr>
  );
}
