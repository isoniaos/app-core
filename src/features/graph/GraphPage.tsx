import { useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { AsyncContent } from "../../ui/AsyncContent";
import { PageHeader } from "../../ui/PageHeader";
import { Badge } from "../../ui/StatusBadge";
import { requireParam } from "../../utils/route-params";

export function GraphPage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const graph = useIsoniaQuery(() => client.getGraph(orgId), [client, orgId]);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Governance Graph"
        description="Bodies, holders, roles, proposals, and governance relationships."
      />
      <AsyncContent state={graph} isEmpty={(data) => data.nodes.length === 0}>
        {(data) => (
          <div className="two-column-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Nodes</h2>
                <Badge>{data.nodes.length}</Badge>
              </div>
              <div className="list-stack">
                {data.nodes.map((node) => (
                  <div className="list-row" key={node.id}>
                    <div>
                      <strong>{node.label}</strong>
                      <span>{node.id}</span>
                    </div>
                    <Badge>{node.type}</Badge>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Edges</h2>
                <Badge>{data.edges.length}</Badge>
              </div>
              <div className="list-stack">
                {data.edges.map((edge) => (
                  <div className="list-row" key={edge.id}>
                    <div>
                      <strong>{edge.label || edge.type}</strong>
                      <span>
                        {edge.sourceId} to {edge.targetId}
                      </span>
                    </div>
                    <Badge>{edge.type}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </AsyncContent>
    </section>
  );
}

