import type {
  BodyDto,
  GovernanceGraphDto,
  MandateDto,
  OrganizationOverviewDto,
  OrganizationPolicyDto,
  ProposalType,
  RoleDto,
} from "@isonia/types";
import { PROPOSAL_TYPE_CHAIN_MAP } from "@isonia/types";
import type { Edge, Node } from "@xyflow/react";
import {
  bodyDisplay,
  mandateDisplay,
  organizationDisplay,
  roleDisplay,
} from "../../utils/display-labels";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
  formatNumericString,
} from "../../utils/format";

export type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

export type GovernanceStructureNodeKind =
  | "organization"
  | "body"
  | "role"
  | "mandate"
  | "policyRoute";

export type GovernanceStructureEdgeKind =
  | "authority"
  | "membership"
  | "mandate"
  | "policy";

export interface GovernanceStructureData {
  readonly bodies: readonly BodyDto[];
  readonly graph: GovernanceGraphDto | undefined;
  readonly graphError: Error | undefined;
  readonly mandates: readonly MandateDto[];
  readonly overview: OrganizationOverviewDto;
  readonly policies: readonly OrganizationPolicyDto[];
  readonly policiesError: Error | undefined;
  readonly roles: readonly RoleDto[];
}

export interface GovernanceMetric {
  readonly label: string;
  readonly meta: string;
  readonly tone: BadgeTone;
  readonly value: string;
}

export interface GovernanceHealth {
  readonly description: string;
  readonly label: "Modeled" | "Needs review" | "Incomplete";
  readonly tone: BadgeTone;
}

export interface AuthorityCheck {
  readonly label: string;
  readonly status: "Modeled" | "Needs data" | "Not verified";
  readonly tone: BadgeTone;
}

export interface StructureNodeDetail {
  readonly label: string;
  readonly value: string;
}

export interface GovernanceStructureNodeData extends Record<string, unknown> {
  readonly detailItems: readonly StructureNodeDetail[];
  readonly kind: GovernanceStructureNodeKind;
  readonly routePath?: string;
  readonly statusLabel?: string;
  readonly statusTone?: BadgeTone;
  readonly subtitle: string;
  readonly title: string;
}

export interface GovernanceStructureEdgeData extends Record<string, unknown> {
  readonly kind: GovernanceStructureEdgeKind;
  readonly label: string;
}

export type GovernanceStructureNode = Node<
  GovernanceStructureNodeData,
  GovernanceStructureNodeKind
>;

export type GovernanceStructureEdge = Edge<GovernanceStructureEdgeData>;

export interface GovernanceStructureModel {
  readonly activePolicyCount: number;
  readonly authorityChecks: readonly AuthorityCheck[];
  readonly edges: readonly GovernanceStructureEdge[];
  readonly hasInactiveData: boolean;
  readonly health: GovernanceHealth;
  readonly metrics: readonly GovernanceMetric[];
  readonly nodes: readonly GovernanceStructureNode[];
  readonly structureOverview: readonly StructureNodeDetail[];
}

interface MandateState {
  readonly label: string;
  readonly rank: "active" | "revoked" | "expired" | "not-yet-active" | "inactive";
  readonly tone: BadgeTone;
}

interface ProposalScopeDisplay {
  readonly fallbackLabel: string | undefined;
  readonly proposalTypes: readonly ProposalType[];
}

export function buildGovernanceStructureModel({
  data,
  nowSeconds,
}: {
  readonly data: GovernanceStructureData;
  readonly nowSeconds: number;
}): GovernanceStructureModel {
  const activeBodies = data.bodies.filter((body) => body.active);
  const activeRoles = data.roles.filter((role) => role.active);
  const mandateStates = data.mandates.map((mandate) =>
    getMandateState(mandate, nowSeconds),
  );
  const activeMandates = mandateStates.filter(
    (state) => state.rank === "active",
  );
  const revokedMandates = mandateStates.filter(
    (state) => state.rank === "revoked",
  );
  const expiredMandates = mandateStates.filter(
    (state) => state.rank === "expired",
  );
  const enabledPolicies = data.policies.filter((policy) => policy.enabled);
  const health = getGovernanceHealth({
    activeBodies: activeBodies.length,
    activeMandates: activeMandates.length,
    activePolicies: enabledPolicies.length,
    activeRoles: activeRoles.length,
  });
  const authorityChecks = getAuthorityChecks(data, activeMandates.length);
  const nodes = buildNodes(data, nowSeconds);
  const edges = buildEdges(data);

  return {
    activePolicyCount: enabledPolicies.length,
    authorityChecks,
    edges,
    hasInactiveData:
      activeBodies.length < data.bodies.length ||
      activeRoles.length < data.roles.length ||
      activeMandates.length < data.mandates.length ||
      enabledPolicies.length < data.policies.length,
    health,
    metrics: [
      {
        label: "Bodies",
        value: String(data.bodies.length),
        meta: data.bodies.length
          ? `${activeBodies.length} active / ${
              data.bodies.length - activeBodies.length
            } inactive`
          : "No bodies indexed",
        tone: data.bodies.length ? "success" : "warning",
      },
      {
        label: "Roles",
        value: String(data.roles.length),
        meta: data.roles.length
          ? `${activeRoles.length} active / ${
              data.roles.length - activeRoles.length
            } inactive`
          : "No roles indexed",
        tone: data.roles.length ? "success" : "warning",
      },
      {
        label: "Mandates",
        value: String(data.mandates.length),
        meta: data.mandates.length
          ? `${activeMandates.length} active / ${revokedMandates.length} revoked / ${expiredMandates.length} expired`
          : "No mandates indexed",
        tone: activeMandates.length ? "success" : "warning",
      },
      {
        label: "Policy Routes",
        value: String(enabledPolicies.length),
        meta: data.policiesError
          ? "Policy data unavailable"
          : `${data.policies.length} total indexed rules`,
        tone: enabledPolicies.length ? "success" : "warning",
      },
      {
        label: "Governance Health",
        value: health.label,
        meta: health.description,
        tone: health.tone,
      },
    ],
    nodes,
    structureOverview: [
      {
        label: "Root Authority",
        value: data.overview.organization.adminAddress ? "1" : "Needs data",
      },
      { label: "Bodies", value: String(data.bodies.length) },
      { label: "Roles", value: String(data.roles.length) },
      { label: "Mandates", value: String(data.mandates.length) },
      { label: "Policy Rules", value: String(data.policies.length) },
      { label: "Active Policy Routes", value: String(enabledPolicies.length) },
      {
        label: "Indexed Graph",
        value: data.graph
          ? `${data.graph.nodes.length} nodes / ${data.graph.edges.length} edges`
          : "Needs data",
      },
    ],
  };
}

function buildNodes(
  data: GovernanceStructureData,
  nowSeconds: number,
): readonly GovernanceStructureNode[] {
  const organization = data.overview.organization;
  const organizationText = organizationDisplay(organization, undefined);
  const nodes: GovernanceStructureNode[] = [
    {
      id: organizationNodeId(organization.orgId),
      type: "organization",
      position: { x: 0, y: 0 },
      data: {
        detailItems: [
          { label: "Org ID", value: organization.orgId },
          { label: "Admin", value: formatAddress(organization.adminAddress) },
          { label: "Status", value: formatLabel(organization.status) },
          { label: "Created block", value: organization.createdBlock },
        ],
        kind: "organization",
        routePath: `/orgs/${organization.orgId}`,
        statusLabel: "Root authority",
        statusTone: organization.adminAddress ? "success" : "warning",
        subtitle: organizationText.subtitle ?? `Org #${organization.orgId}`,
        title: organizationText.title,
      },
    },
  ];

  for (const body of sortByNumeric(data.bodies, (body) => body.bodyId)) {
    const display = bodyDisplay(body, body.bodyId, undefined);
    nodes.push({
      id: bodyNodeId(body.bodyId),
      type: "body",
      position: { x: 0, y: 0 },
      data: {
        detailItems: [
          { label: "Body ID", value: body.bodyId },
          { label: "Kind", value: formatLabel(body.kind) },
          { label: "Status", value: body.active ? "Active" : "Inactive" },
          { label: "Created block", value: body.createdBlock },
        ],
        kind: "body",
        statusLabel: body.active ? "Active" : "Inactive",
        statusTone: body.active ? "success" : "muted",
        subtitle: `${countRoles(data.roles, body.bodyId)} roles / ${countBodyMandates(
          data.mandates,
          body.bodyId,
        )} mandates`,
        title: display.title,
      },
    });
  }

  for (const role of sortByNumeric(data.roles, (role) => role.roleId)) {
    const display = roleDisplay(role, role.roleId, undefined);
    nodes.push({
      id: roleNodeId(role.roleId),
      type: "role",
      position: { x: 0, y: 0 },
      data: {
        detailItems: [
          { label: "Role ID", value: role.roleId },
          { label: "Body ID", value: role.bodyId },
          { label: "Role type", value: formatLabel(role.roleType) },
          { label: "Status", value: role.active ? "Active" : "Inactive" },
        ],
        kind: "role",
        statusLabel: role.active ? "Active" : "Inactive",
        statusTone: role.active ? "success" : "muted",
        subtitle: `${countRoleMandates(
          data.mandates,
          role.bodyId,
          role.roleId,
        )} mandates`,
        title: display.title,
      },
    });
  }

  for (const mandate of sortByNumeric(
    data.mandates,
    (mandate) => mandate.mandateId,
  )) {
    const state = getMandateState(mandate, nowSeconds);
    const display = mandateDisplay(mandate);
    nodes.push({
      id: mandateNodeId(mandate.mandateId),
      type: "mandate",
      position: { x: 0, y: 0 },
      data: {
        detailItems: [
          { label: "Mandate ID", value: mandate.mandateId },
          { label: "Holder", value: formatAddress(mandate.holderAddress) },
          { label: "Role ID", value: mandate.roleId },
          { label: "Scope", value: getProposalScopeLabel(mandate.proposalTypeMask) },
          { label: "Starts", value: formatMandateStart(mandate.startTime) },
          { label: "Ends", value: formatMandateEnd(mandate.endTime) },
        ],
        kind: "mandate",
        statusLabel: state.label,
        statusTone: state.tone,
        subtitle: display.subtitle ?? `Mandate #${mandate.mandateId}`,
        title: display.title,
      },
    });
  }

  for (const policy of sortPolicies(data.policies)) {
    nodes.push({
      id: policyNodeId(policy.proposalType, policy.version),
      type: "policyRoute",
      position: { x: 0, y: 0 },
      data: {
        detailItems: [
          { label: "Proposal type", value: formatLabel(policy.proposalType) },
          { label: "Policy version", value: policy.version },
          {
            label: "Required bodies",
            value: formatBodyIds(policy.requiredApprovalBodies),
          },
          { label: "Veto bodies", value: formatBodyIds(policy.vetoBodies) },
          {
            label: "Executor body",
            value: policy.executorBody ? `Body #${policy.executorBody}` : "Not set",
          },
          {
            label: "Timelock",
            value: formatDurationSeconds(policy.timelockSeconds),
          },
        ],
        kind: "policyRoute",
        statusLabel: policy.enabled ? "Enabled" : "Disabled",
        statusTone: policy.enabled ? "success" : "muted",
        subtitle: `Policy v${policy.version}`,
        title: `${formatLabel(policy.proposalType)} route`,
      },
    });
  }

  return nodes;
}

function buildEdges(
  data: GovernanceStructureData,
): readonly GovernanceStructureEdge[] {
  const organization = data.overview.organization;
  const bodyIds = new Set(data.bodies.map((body) => body.bodyId));
  const roleIds = new Set(data.roles.map((role) => role.roleId));
  const edges: GovernanceStructureEdge[] = [];

  for (const body of data.bodies) {
    edges.push({
      id: `authority:${organization.orgId}:${body.bodyId}`,
      source: organizationNodeId(organization.orgId),
      target: bodyNodeId(body.bodyId),
      type: "smoothstep",
      animated: false,
      data: { kind: "authority", label: "Authority" },
      className: "governance-flow-edge governance-flow-edge-authority",
    });
  }

  for (const role of data.roles) {
    if (!bodyIds.has(role.bodyId)) {
      continue;
    }
    edges.push({
      id: `membership:${role.bodyId}:${role.roleId}`,
      source: bodyNodeId(role.bodyId),
      target: roleNodeId(role.roleId),
      type: "smoothstep",
      data: { kind: "membership", label: "Role belongs to body" },
      className: "governance-flow-edge governance-flow-edge-membership",
    });
  }

  for (const mandate of data.mandates) {
    if (!roleIds.has(mandate.roleId)) {
      continue;
    }
    edges.push({
      id: `mandate:${mandate.roleId}:${mandate.mandateId}`,
      source: roleNodeId(mandate.roleId),
      target: mandateNodeId(mandate.mandateId),
      type: "smoothstep",
      data: { kind: "mandate", label: "Mandate assignment" },
      className: "governance-flow-edge governance-flow-edge-mandate",
    });
  }

  for (const policy of data.policies) {
    const policyId = policyNodeId(policy.proposalType, policy.version);
    for (const bodyId of policy.requiredApprovalBodies) {
      if (!bodyIds.has(bodyId)) {
        continue;
      }
      edges.push({
        id: `policy:approval:${bodyId}:${policy.proposalType}:${policy.version}`,
        source: bodyNodeId(bodyId),
        target: policyId,
        type: "smoothstep",
        data: { kind: "policy", label: "Required approval" },
        className: "governance-flow-edge governance-flow-edge-policy",
      });
    }
    for (const bodyId of policy.vetoBodies) {
      if (!bodyIds.has(bodyId)) {
        continue;
      }
      edges.push({
        id: `policy:veto:${bodyId}:${policy.proposalType}:${policy.version}`,
        source: bodyNodeId(bodyId),
        target: policyId,
        type: "smoothstep",
        data: { kind: "policy", label: "Veto reference" },
        className:
          "governance-flow-edge governance-flow-edge-policy governance-flow-edge-policy-veto",
      });
    }
    if (policy.executorBody && bodyIds.has(policy.executorBody)) {
      edges.push({
        id: `policy:executor:${policy.executorBody}:${policy.proposalType}:${policy.version}`,
        source: bodyNodeId(policy.executorBody),
        target: policyId,
        type: "smoothstep",
        data: { kind: "policy", label: "Executor reference" },
        className: "governance-flow-edge governance-flow-edge-policy",
      });
    }
  }

  return edges;
}

function getGovernanceHealth({
  activeBodies,
  activeMandates,
  activePolicies,
  activeRoles,
}: {
  readonly activeBodies: number;
  readonly activeMandates: number;
  readonly activePolicies: number;
  readonly activeRoles: number;
}): GovernanceHealth {
  if (
    activeBodies > 0 &&
    activeRoles > 0 &&
    activeMandates > 0 &&
    activePolicies > 0
  ) {
    return {
      description: "Core read models present",
      label: "Modeled",
      tone: "success",
    };
  }

  if (activeBodies > 0 || activeRoles > 0 || activeMandates > 0 || activePolicies > 0) {
    return {
      description: "Indexed structure is partial",
      label: "Needs review",
      tone: "warning",
    };
  }

  return {
    description: "Activation data is incomplete",
    label: "Incomplete",
    tone: "warning",
  };
}

function getAuthorityChecks(
  data: GovernanceStructureData,
  activeMandates: number,
): readonly AuthorityCheck[] {
  const hasBodiesAndRoles = data.bodies.length > 0 && data.roles.length > 0;
  const hasPolicies = data.policies.length > 0;
  const hasVetoPolicy = data.policies.some((policy) => policy.vetoBodies.length > 0);
  const hasTimelockPolicy = data.policies.some(
    (policy) => parseNumericBigInt(policy.timelockSeconds) !== 0n,
  );

  return [
    {
      label: "Top-down authorization",
      status: hasBodiesAndRoles ? "Modeled" : "Needs data",
      tone: hasBodiesAndRoles ? "success" : "warning",
    },
    {
      label: "Mandate enforcement",
      status: activeMandates > 0 ? "Modeled" : "Needs data",
      tone: activeMandates > 0 ? "success" : "warning",
    },
    {
      label: "Policy validation",
      status: hasPolicies ? "Modeled" : "Needs data",
      tone: hasPolicies ? "success" : "warning",
    },
    {
      label: "Veto protection",
      status: hasVetoPolicy ? "Modeled" : "Not verified",
      tone: hasVetoPolicy ? "success" : "muted",
    },
    {
      label: "Timelock enforcement",
      status: hasTimelockPolicy ? "Modeled" : "Not verified",
      tone: hasTimelockPolicy ? "success" : "muted",
    },
  ];
}

export function getMandateState(
  mandate: MandateDto,
  nowSeconds: number,
): MandateState {
  const startTime = parseNumericBigInt(mandate.startTime);
  const endTime = parseNumericBigInt(mandate.endTime);
  const now = BigInt(nowSeconds);

  if (mandate.revoked) {
    return { label: "Revoked", rank: "revoked", tone: "danger" };
  }

  if (startTime !== undefined && startTime > now) {
    return { label: "Not yet active", rank: "not-yet-active", tone: "warning" };
  }

  if (endTime !== undefined && endTime > 0n && endTime <= now) {
    return { label: "Expired", rank: "expired", tone: "muted" };
  }

  if (mandate.active) {
    return { label: "Active", rank: "active", tone: "success" };
  }

  return { label: "Inactive", rank: "inactive", tone: "muted" };
}

export function getProposalScopeLabel(mask: string): string {
  const scope = getProposalScopeDisplay(mask);
  const labels = scope.proposalTypes.map((proposalType) =>
    formatLabel(proposalType),
  );
  return [...labels, scope.fallbackLabel].filter(Boolean).join(", ");
}

export function formatMandateStart(value: string): string {
  return parseNumericBigInt(value) === 0n ? "Immediate" : formatChainTime(value);
}

export function formatMandateEnd(value: string): string {
  return parseNumericBigInt(value) === 0n ? "No end time" : formatChainTime(value);
}

export function formatDurationSeconds(value: string): string {
  const parsed = parseNumericBigInt(value);
  if (parsed === 0n) {
    return "No timelock";
  }
  if (parsed === undefined) {
    return `${value} seconds`;
  }

  const seconds = Number(parsed);
  if (!Number.isSafeInteger(seconds)) {
    return `${formatNumericString(value)} seconds`;
  }

  if (seconds < 60) {
    return `${seconds.toLocaleString()} seconds`;
  }

  const minutes = seconds / 60;
  if (Number.isInteger(minutes) && minutes < 60) {
    return `${minutes.toLocaleString()} minutes`;
  }

  const hours = minutes / 60;
  if (Number.isInteger(hours) && hours < 48) {
    return `${hours.toLocaleString()} hours`;
  }

  const days = hours / 24;
  return Number.isInteger(days)
    ? `${days.toLocaleString()} days`
    : `${formatNumericString(value)} seconds`;
}

export function parseNumericBigInt(value: string): bigint | undefined {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

export function sortByNumeric<TValue>(
  values: readonly TValue[],
  getValue: (value: TValue) => string,
): readonly TValue[] {
  return [...values].sort((left, right) =>
    compareNumericString(getValue(left), getValue(right)),
  );
}

export function sortPolicies(
  policies: readonly OrganizationPolicyDto[],
): readonly OrganizationPolicyDto[] {
  return [...policies].sort((left, right) => {
    const typeOrder = left.proposalType.localeCompare(right.proposalType);
    return typeOrder === 0
      ? compareNumericString(left.version, right.version)
      : typeOrder;
  });
}

function getProposalScopeDisplay(mask: string): ProposalScopeDisplay {
  const parsedMask = parseNumericBigInt(mask);
  if (parsedMask === undefined) {
    return { fallbackLabel: `Mask ${mask}`, proposalTypes: [] };
  }

  const proposalTypes = Object.entries(
    PROPOSAL_TYPE_CHAIN_MAP.valuesByCode,
  ).flatMap(([code, proposalType]) => {
    const bit = 1n << BigInt(code);
    return (parsedMask & bit) !== 0n ? [proposalType] : [];
  });

  if (parsedMask === 0n) {
    return { fallbackLabel: "No proposal types", proposalTypes };
  }

  return {
    fallbackLabel: proposalTypes.length === 0 ? `Mask ${mask}` : undefined,
    proposalTypes,
  };
}

function countRoles(roles: readonly RoleDto[], bodyId: string): number {
  return roles.filter((role) => role.bodyId === bodyId).length;
}

function countBodyMandates(
  mandates: readonly MandateDto[],
  bodyId: string,
): number {
  return mandates.filter((mandate) => mandate.bodyId === bodyId).length;
}

function countRoleMandates(
  mandates: readonly MandateDto[],
  bodyId: string,
  roleId: string,
): number {
  return mandates.filter(
    (mandate) => mandate.bodyId === bodyId && mandate.roleId === roleId,
  ).length;
}

function formatBodyIds(bodyIds: readonly string[]): string {
  return bodyIds.length
    ? bodyIds.map((bodyId) => `Body #${bodyId}`).join(", ")
    : "None";
}

function organizationNodeId(orgId: string): string {
  return `organization:${orgId}`;
}

function bodyNodeId(bodyId: string): string {
  return `body:${bodyId}`;
}

function roleNodeId(roleId: string): string {
  return `role:${roleId}`;
}

function mandateNodeId(mandateId: string): string {
  return `mandate:${mandateId}`;
}

function policyNodeId(proposalType: ProposalType, version: string): string {
  return `policy:${proposalType}:${version}`;
}

function compareNumericString(left: string, right: string): number {
  const leftValue = Number(left);
  const rightValue = Number(right);

  if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
    return leftValue - rightValue;
  }

  return left.localeCompare(right);
}
