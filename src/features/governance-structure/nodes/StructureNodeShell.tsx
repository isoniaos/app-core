import { Handle, Position, type NodeProps } from "@xyflow/react";
import type {
  GovernanceStructureNode,
  GovernanceStructureNodeKind,
} from "../governance-structure-model";

const KIND_LABEL: Record<GovernanceStructureNodeKind, string> = {
  body: "B",
  mandate: "M",
  organization: "O",
  policyRoute: "P",
  role: "R",
};

export function StructureNodeShell({
  node,
  selected,
}: {
  readonly node: NodeProps<GovernanceStructureNode>;
  readonly selected: boolean;
}): JSX.Element {
  const { data } = node;

  return (
    <article
      className={[
        "governance-flow-node",
        `governance-flow-node-${data.kind}`,
        selected ? "governance-flow-node-selected" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle
        className="governance-flow-handle"
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <div className="governance-flow-node-main">
        <span className="governance-flow-node-icon" aria-hidden="true">
          {KIND_LABEL[data.kind]}
        </span>
        <div>
          <strong>{data.title}</strong>
          <span>{data.subtitle}</span>
        </div>
      </div>
      {data.statusLabel ? (
        <span
          className={`badge badge-${data.statusTone ?? "muted"} governance-flow-node-status`}
        >
          {data.statusLabel}
        </span>
      ) : null}
      <Handle
        className="governance-flow-handle"
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </article>
  );
}
