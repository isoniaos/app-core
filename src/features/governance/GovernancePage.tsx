import type { BodyDto, MandateDto, RoleDto } from "@isonia/types";
import { useParams } from "react-router-dom";
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

interface GovernanceData {
  readonly bodies: readonly BodyDto[];
  readonly roles: readonly RoleDto[];
  readonly mandates: readonly MandateDto[];
}

export function GovernancePage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const governance = useIsoniaQuery(
    async (): Promise<GovernanceData> => {
      const [bodies, roles, mandates] = await Promise.all([
        client.getBodies(orgId),
        client.getRoles(orgId),
        client.getMandates(orgId),
      ]);
      return { bodies, roles, mandates };
    },
    [client, orgId],
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Governance Structure"
        description="Bodies, roles, and holder mandates projected from protocol events."
      />
      <AsyncContent
        state={governance}
        isEmpty={(data) =>
          data.bodies.length === 0 &&
          data.roles.length === 0 &&
          data.mandates.length === 0
        }
      >
        {(data) => (
          <>
            <section className="panel">
              <div className="panel-header">
                <h2>Bodies and roles</h2>
              </div>
              <div className="card-grid">
                {data.bodies.map((body) => (
                  <article className="entity-card" key={body.bodyId}>
                    <div className="entity-card-header">
                      <div>
                        <h3>{body.name}</h3>
                        <p>Body #{body.bodyId}</p>
                      </div>
                      <StatusBadge tone={body.active ? "success" : "muted"}>
                        {body.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </div>
                    <dl className="detail-list">
                      <div>
                        <dt>Kind</dt>
                        <dd>{formatLabel(body.kind)}</dd>
                      </div>
                      <div>
                        <dt>Created block</dt>
                        <dd>{body.createdBlock}</dd>
                      </div>
                      <div>
                        <dt>Data status</dt>
                        <dd>
                          <DataStatusBadge status={body.dataStatus} />
                        </dd>
                      </div>
                    </dl>
                    <div className="chip-row">
                      {data.roles
                        .filter((role) => role.bodyId === body.bodyId)
                        .map((role) => (
                          <span className="chip" key={role.roleId}>
                            {role.name} - {formatLabel(role.roleType)}
                          </span>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Mandates</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Holder</th>
                      <th>Body</th>
                      <th>Role</th>
                      <th>Starts</th>
                      <th>Ends</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mandates.map((mandate) => (
                      <tr key={mandate.mandateId}>
                        <td>{formatAddress(mandate.holderAddress)}</td>
                        <td>#{mandate.bodyId}</td>
                        <td>#{mandate.roleId}</td>
                        <td>{formatChainTime(mandate.startTime)}</td>
                        <td>{formatChainTime(mandate.endTime)}</td>
                        <td>
                          <StatusBadge
                            tone={
                              mandate.active && !mandate.revoked
                                ? "success"
                                : "muted"
                            }
                          >
                            {mandate.revoked
                              ? "Revoked"
                              : mandate.active
                                ? "Active"
                                : "Inactive"}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </AsyncContent>
    </section>
  );
}

