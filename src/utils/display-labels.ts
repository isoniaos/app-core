import type {
  BodyDto,
  GovernanceGraphNodeDto,
  MandateDto,
  OrganizationDto,
  ProposalDto,
  ProposalSummaryDto,
  RoleDto,
} from "@isonia/types";
import { GraphNodeType } from "@isonia/types";
import type { MetadataRecord } from "../metadata/types";
import { formatAddress, formatLabel } from "./format";

interface DisplayText {
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
}

type ProposalLike = Pick<
  ProposalDto | ProposalSummaryDto,
  "proposalId" | "proposalType" | "title"
>;

export function metadataTitle(
  metadata: MetadataRecord | undefined,
): string | undefined {
  return cleanText(metadata?.name) ?? cleanText(metadata?.title);
}

export function organizationDisplay(
  organization: OrganizationDto,
  metadata: MetadataRecord | undefined,
): DisplayText {
  const title =
    metadataTitle(metadata) ??
    readableStoredLabel(organization.name, `Organization #${organization.orgId}`) ??
    readableSlug(organization.slug) ??
    `Organization #${organization.orgId}`;

  return {
    title,
    subtitle: `Organization #${organization.orgId}`,
    description: cleanText(metadata?.description) ?? organization.slug,
  };
}

export function bodyDisplay(
  body: BodyDto | undefined,
  bodyId: string,
  metadata: MetadataRecord | undefined,
): DisplayText {
  const kindLabel = body ? formatLabel(body.kind) : undefined;
  const title =
    metadataTitle(metadata) ??
    readableStoredLabel(body?.name, `Body #${bodyId}`) ??
    kindLabel ??
    `Body #${bodyId}`;

  return {
    title,
    subtitle: `Body #${bodyId}`,
    description: cleanText(metadata?.description),
  };
}

export function roleDisplay(
  role: RoleDto | undefined,
  roleId: string,
  metadata: MetadataRecord | undefined,
): DisplayText {
  const roleTypeLabel = role ? `${formatLabel(role.roleType)} Role` : undefined;
  const title =
    metadataTitle(metadata) ??
    readableStoredLabel(role?.name, `Role #${roleId}`) ??
    roleTypeLabel ??
    `Role #${roleId}`;

  return {
    title,
    subtitle: `Role #${roleId}`,
    description: cleanText(metadata?.description),
  };
}

export function mandateDisplay(mandate: MandateDto): DisplayText {
  return {
    title: formatAddress(mandate.holderAddress),
    subtitle: `Mandate #${mandate.mandateId}`,
  };
}

export function proposalDisplay(
  proposal: ProposalLike,
  metadata: MetadataRecord | undefined,
): DisplayText {
  const fallbackTitle = `${formatLabel(proposal.proposalType)} Proposal #${proposal.proposalId}`;
  const title =
    metadataTitle(metadata) ??
    readableStoredLabel(proposal.title, `Proposal #${proposal.proposalId}`) ??
    fallbackTitle;

  return {
    title,
    subtitle: `Proposal #${proposal.proposalId}`,
    description: cleanText(metadata?.description),
  };
}

export function graphNodeDisplay(node: GovernanceGraphNodeDto): DisplayText {
  const idParts = parseNodeId(node.id);
  const fallback = fallbackGraphNodeLabel(node, idParts.identifier);
  const title = readableStoredLabel(node.label, fallback) ?? fallback;

  return {
    title,
    subtitle: node.id,
  };
}

function fallbackGraphNodeLabel(
  node: GovernanceGraphNodeDto,
  identifier: string,
): string {
  if (node.type === GraphNodeType.Body) {
    return metadataString(node.metadata, "kind") ?? `Body #${identifier}`;
  }

  if (node.type === GraphNodeType.Role) {
    const roleType = metadataString(node.metadata, "roleType");
    return roleType ? `${formatLabel(roleType)} Role` : `Role #${identifier}`;
  }

  if (node.type === GraphNodeType.Proposal) {
    const status = metadataString(node.metadata, "status");
    return status
      ? `${formatLabel(status)} Proposal #${identifier}`
      : `Proposal #${identifier}`;
  }

  if (node.type === GraphNodeType.Organization) {
    return `Organization #${identifier}`;
  }

  if (node.type === GraphNodeType.Holder) {
    return formatAddress(identifier);
  }

  if (node.type === GraphNodeType.ProposalType) {
    return formatLabel(identifier);
  }

  return formatLabel(node.type);
}

function readableStoredLabel(
  value: string | undefined,
  genericFallback: string,
): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned === genericFallback) {
    return undefined;
  }

  return formatLabel(cleaned);
}

function readableSlug(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  return cleaned ? formatLabel(cleaned) : undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseNodeId(id: string): { readonly identifier: string } {
  const [, identifier] = id.split(":", 2);
  return { identifier: identifier ?? id };
}

function metadataString(
  metadata: GovernanceGraphNodeDto["metadata"],
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? formatLabel(value)
    : undefined;
}
