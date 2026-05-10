import type { NodeProps } from "@xyflow/react";
import type { GovernanceStructureNode } from "../governance-structure-model";
import { StructureNodeShell } from "./StructureNodeShell";

export function BodyNode(node: NodeProps<GovernanceStructureNode>): JSX.Element {
  return <StructureNodeShell node={node} selected={node.selected} />;
}
