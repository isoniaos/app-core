import type {
  GovernanceStructureEdge,
  GovernanceStructureNode,
  GovernanceStructureNodeKind,
} from "./governance-structure-model";

const LAYER_Y: Record<GovernanceStructureNodeKind, number> = {
  organization: 0,
  body: 170,
  role: 340,
  mandate: 520,
  policyRoute: 710,
};

const NODE_WIDTH: Record<GovernanceStructureNodeKind, number> = {
  organization: 270,
  body: 250,
  role: 240,
  mandate: 230,
  policyRoute: 260,
};

const LAYER_GAP = 56;

export function layoutGovernanceStructure({
  edges,
  nodes,
}: {
  readonly edges: readonly GovernanceStructureEdge[];
  readonly nodes: readonly GovernanceStructureNode[];
}): {
  readonly edges: readonly GovernanceStructureEdge[];
  readonly nodes: readonly GovernanceStructureNode[];
} {
  const layers = groupByLayer(nodes);
  const positioned = nodes.map((node) => {
    const layer = layers[node.data.kind];
    const index = layer.findIndex((candidate) => candidate.id === node.id);
    const totalWidth = layer.reduce((sum, candidate, candidateIndex) => {
      const width = NODE_WIDTH[candidate.data.kind];
      return sum + width + (candidateIndex === 0 ? 0 : LAYER_GAP);
    }, 0);
    const precedingWidth = layer
      .slice(0, index)
      .reduce(
        (sum, candidate) => sum + NODE_WIDTH[candidate.data.kind] + LAYER_GAP,
        0,
      );
    const ownWidth = NODE_WIDTH[node.data.kind];

    return {
      ...node,
      position: {
        x: precedingWidth - totalWidth / 2 + ownWidth / 2,
        y: LAYER_Y[node.data.kind],
      },
    };
  });

  return { edges, nodes: positioned };
}

function groupByLayer(
  nodes: readonly GovernanceStructureNode[],
): Record<GovernanceStructureNodeKind, readonly GovernanceStructureNode[]> {
  return {
    body: nodes.filter((node) => node.data.kind === "body"),
    mandate: nodes.filter((node) => node.data.kind === "mandate"),
    organization: nodes.filter((node) => node.data.kind === "organization"),
    policyRoute: nodes.filter((node) => node.data.kind === "policyRoute"),
    role: nodes.filter((node) => node.data.kind === "role"),
  };
}
