import type {
  BodyDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
  RouteBodyRequirementDto,
  RouteBodyVetoDto,
} from "@isonia/types";
import { bodyDisplay } from "../../utils/display-labels";

export type ProposalBodyActionRole = "Approver" | "Vetoer" | "Executor";

export function getBodyBaseLabel({
  bodies,
  bodyId,
  bodyName,
}: {
  readonly bodies: readonly BodyDto[];
  readonly bodyId: string;
  readonly bodyName?: string;
}): string {
  const routeName = readableBodyName(bodyName, bodyId);
  if (routeName) {
    return routeName;
  }

  const body = bodies.find((candidate) => candidate.bodyId === bodyId);
  if (body) {
    return bodyDisplay(body, bodyId, undefined).title;
  }

  return fallbackBodyLabel(bodyId);
}

export function getBodyActionLabel({
  bodies,
  bodyId,
  bodyName,
  role,
}: {
  readonly bodies: readonly BodyDto[];
  readonly bodyId: string;
  readonly bodyName?: string;
  readonly role?: ProposalBodyActionRole;
}): string {
  const base = getBodyBaseLabel({ bodies, bodyId, bodyName });
  if (!role || base.toLowerCase().endsWith(role.toLowerCase())) {
    return base;
  }

  return `${base} ${role}`;
}

export function getApprovalBodyLabel({
  bodies,
  body,
}: {
  readonly bodies: readonly BodyDto[];
  readonly body: RouteBodyRequirementDto;
}): string {
  return getBodyActionLabel({
    bodies,
    bodyId: body.bodyId,
    bodyName: body.bodyName,
    role: "Approver",
  });
}

export function getVetoBodyLabel({
  bodies,
  body,
}: {
  readonly bodies: readonly BodyDto[];
  readonly body: RouteBodyVetoDto;
}): string {
  return getBodyActionLabel({
    bodies,
    bodyId: body.bodyId,
    bodyName: body.bodyName,
    role: "Vetoer",
  });
}

export function getExecutorBodyLabel({
  bodies,
  bodyId,
  route,
}: {
  readonly bodies: readonly BodyDto[];
  readonly bodyId: string;
  readonly route?: ProposalRouteExplanationDto;
}): string {
  return getBodyActionLabel({
    bodies,
    bodyId,
    bodyName: getRouteBodyName(route, bodyId),
    role: "Executor",
  });
}

export function getRelatedRouteBodyLabel({
  bodies,
  bodyId,
  route,
  role,
}: {
  readonly bodies: readonly BodyDto[];
  readonly bodyId: string;
  readonly route?: ProposalRouteExplanationDto;
  readonly role?: ProposalBodyActionRole;
}): string {
  return getBodyActionLabel({
    bodies,
    bodyId,
    bodyName: getRouteBodyName(route, bodyId),
    role,
  });
}

export function formatRouteBlockedReasonMessage({
  bodies,
  reason,
  role,
  route,
}: {
  readonly bodies: readonly BodyDto[];
  readonly reason: RouteBlockedReasonDto;
  readonly role?: ProposalBodyActionRole;
  readonly route?: ProposalRouteExplanationDto;
}): string {
  if (!reason.relatedBodyId) {
    return reason.message;
  }

  const label = getRelatedRouteBodyLabel({
    bodies,
    bodyId: reason.relatedBodyId,
    route,
    role,
  });

  return reason.message
    .replaceAll(`Body #${reason.relatedBodyId}`, label)
    .replaceAll(`body #${reason.relatedBodyId}`, label);
}

export function formatBodyList(
  bodies: readonly (RouteBodyRequirementDto | RouteBodyVetoDto)[],
  indexedBodies: readonly BodyDto[],
  role: ProposalBodyActionRole,
): string {
  if (bodies.length === 0) {
    return "none";
  }

  return bodies
    .map((body) =>
      getBodyActionLabel({
        bodies: indexedBodies,
        bodyId: body.bodyId,
        bodyName: body.bodyName,
        role,
      }),
    )
    .join(", ");
}

function getRouteBodyName(
  route: ProposalRouteExplanationDto | undefined,
  bodyId: string,
): string | undefined {
  return (
    route?.requiredApprovalBodies.find((body) => body.bodyId === bodyId)
      ?.bodyName ??
    route?.vetoBodies.find((body) => body.bodyId === bodyId)?.bodyName
  );
}

function readableBodyName(
  bodyName: string | undefined,
  bodyId: string,
): string | undefined {
  const trimmed = bodyName?.trim();
  if (!trimmed || trimmed === fallbackBodyLabel(bodyId)) {
    return undefined;
  }

  return trimmed;
}

function fallbackBodyLabel(bodyId: string): string {
  return `Body #${bodyId}`;
}
