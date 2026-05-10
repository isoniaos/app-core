import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import type {
  GovernanceStructureEdge,
  GovernanceStructureNode,
} from "./governance-structure-model";
import { layoutGovernanceStructure } from "./governance-structure-layout";
import { BodyNode } from "./nodes/BodyNode";
import { MandateNode } from "./nodes/MandateNode";
import { OrganizationNode } from "./nodes/OrganizationNode";
import { PolicyRouteNode } from "./nodes/PolicyRouteNode";
import { RoleNode } from "./nodes/RoleNode";

const NODE_TYPES = {
  body: BodyNode,
  mandate: MandateNode,
  organization: OrganizationNode,
  policyRoute: PolicyRouteNode,
  role: RoleNode,
} satisfies NodeTypes;

export function GovernanceStructureGraph({
  edges,
  fitSignal,
  nodes,
  onSelectedNodeChange,
  selectedNodeId,
}: {
  readonly edges: readonly GovernanceStructureEdge[];
  readonly fitSignal: number;
  readonly nodes: readonly GovernanceStructureNode[];
  readonly onSelectedNodeChange: (nodeId: string | undefined) => void;
  readonly selectedNodeId: string | undefined;
}): JSX.Element {
  return (
    <ReactFlowProvider>
      <GovernanceStructureGraphCanvas
        edges={edges}
        fitSignal={fitSignal}
        nodes={nodes}
        onSelectedNodeChange={onSelectedNodeChange}
        selectedNodeId={selectedNodeId}
      />
    </ReactFlowProvider>
  );
}

function GovernanceStructureGraphCanvas({
  edges,
  fitSignal,
  nodes,
  onSelectedNodeChange,
  selectedNodeId,
}: {
  readonly edges: readonly GovernanceStructureEdge[];
  readonly fitSignal: number;
  readonly nodes: readonly GovernanceStructureNode[];
  readonly onSelectedNodeChange: (nodeId: string | undefined) => void;
  readonly selectedNodeId: string | undefined;
}): JSX.Element {
  const { fitView } = useReactFlow<GovernanceStructureNode, GovernanceStructureEdge>();
  const layout = useMemo(
    () =>
      layoutGovernanceStructure({
        edges,
        nodes: nodes.map((node) => ({
          ...node,
          selected: node.id === selectedNodeId,
        })),
      }),
    [edges, nodes, selectedNodeId],
  );

  useEffect(() => {
    window.requestAnimationFrame(() => {
      void fitView({ duration: 260, padding: 0.18 });
    });
  }, [fitSignal, fitView, layout.nodes.length]);

  return (
    <ReactFlow<GovernanceStructureNode, GovernanceStructureEdge>
      className="governance-flow-canvas"
      colorMode="light"
      edges={[...layout.edges]}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      maxZoom={1.4}
      minZoom={0.22}
      nodeTypes={NODE_TYPES}
      nodes={[...layout.nodes]}
      nodesConnectable={false}
      nodesDraggable={false}
      panOnScroll
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_event, node) => onSelectedNodeChange(node.id)}
      onPaneClick={() => onSelectedNodeChange(undefined)}
    >
      <Background color="#CBD5E1" gap={24} size={1} />
      <Controls fitViewOptions={{ padding: 0.18 }} showInteractive={false} />
      <MiniMap
        className="governance-flow-minimap"
        maskColor="rgba(248, 247, 242, 0.72)"
        nodeBorderRadius={8}
        nodeColor="#E2E8F0"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}
