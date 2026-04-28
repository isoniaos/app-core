import type {
  GovernanceGraphEdgeDto,
  GovernanceGraphNodeDto,
} from "@isonia/types";
import { useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { AsyncContent } from "../../ui/AsyncContent";
import { PageHeader } from "../../ui/PageHeader";
import { Badge } from "../../ui/StatusBadge";
import { graphNodeDisplay } from "../../utils/display-labels";
import { formatLabel } from "../../utils/format";
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
      <AsyncContent
        state={graph}
        isEmpty={(data) => data.nodes.length === 0}
        loadingTitle="Loading governance graph"
        loadingMessage="Reading graph nodes and relationships from projections."
        emptyTitle="No graph data indexed"
        emptyMessage="This organization has no graph nodes in the current read model."
        errorTitle="Unable to load governance graph"
      >
        {(data) => (
          <div className="two-column-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Nodes</h2>
                <Badge>{data.nodes.length}</Badge>
              </div>
              <div className="list-stack">
                {data.nodes.map((node) => (
                  <GraphNodeRow key={node.id} node={node} />
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
                  <GraphEdgeRow edge={edge} key={edge.id} />
                ))}
              </div>
            </section>
          </div>
        )}
      </AsyncContent>
    </section>
  );
}

function GraphNodeRow({
  node,
}: {
  readonly node: GovernanceGraphNodeDto;
}): JSX.Element {
  const display = graphNodeDisplay(node);

  return (
    <div className="list-row">
      <div>
        <strong>{display.title}</strong>
        <span>{display.subtitle}</span>
      </div>
      <Badge>{formatLabel(node.type)}</Badge>
    </div>
  );
}

function GraphEdgeRow({
  edge,
}: {
  readonly edge: GovernanceGraphEdgeDto;
}): JSX.Element {
  return (
    <div className="list-row">
      <div>
        <strong>{formatLabel(edge.label || edge.type)}</strong>
        <span>
          {edge.sourceId} to {edge.targetId}
        </span>
      </div>
      <Badge>{formatLabel(edge.type)}</Badge>
    </div>
  );
}
