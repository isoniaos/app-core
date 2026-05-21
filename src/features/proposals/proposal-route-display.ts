import type {
  BodyDto,
  ProposalDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
} from "@isonia/types";
import { ProposalStatus, RouteBlockedReasonCode } from "@isonia/types";
import {
  formatRouteBlockedReasonMessage,
  getExecutorBodyLabel,
  getRelatedRouteBodyLabel,
} from "./proposal-body-labels";
import { formatLabel } from "../../utils/format";
import {
  isCompletedProposalStatus,
  isTerminalProposalStatus,
} from "./proposal-status-helpers";

export type ProposalRouteDisplayTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export interface ProposalNextActionContext {
  readonly actor: string;
  readonly detail: string;
  readonly label: string;
  readonly title: string;
  readonly tone: ProposalRouteDisplayTone;
}

export interface RouteNextActionSummary {
  readonly detail: string;
  readonly value: string;
}

export interface RouteBlockedReasonsSectionDisplay {
  readonly description: string;
  readonly emptyMessage: string;
  readonly emptyTitle: string;
  readonly title: string;
}

export interface RoutePanelDisplay {
  readonly blockedReasonsSection: RouteBlockedReasonsSectionDisplay;
  readonly executionBadgeLabel: string;
  readonly executionStateSummary: string;
  readonly executionStateTitle: string;
  readonly executionTone: ProposalRouteDisplayTone;
  readonly heroBadgeLabel: string;
  readonly heroSummary: string;
  readonly heroTitle: string;
  readonly nextActionLabel: string;
  readonly nextActionSummary: RouteNextActionSummary;
  readonly terminal: boolean;
}

const terminalBlockedReasonCodes: readonly RouteBlockedReasonCode[] = [
  RouteBlockedReasonCode.Vetoed,
  RouteBlockedReasonCode.AlreadyExecuted,
  RouteBlockedReasonCode.Cancelled,
  RouteBlockedReasonCode.Expired,
] as const;

export function getProposalStatusTone(
  status: ProposalStatus,
): ProposalRouteDisplayTone {
  if (status === ProposalStatus.Executed || status === ProposalStatus.Approved) {
    return "success";
  }

  if (
    status === ProposalStatus.Cancelled ||
    status === ProposalStatus.Expired ||
    status === ProposalStatus.Vetoed
  ) {
    return "danger";
  }

  if (status === ProposalStatus.Queued || status === ProposalStatus.UnderReview) {
    return "warning";
  }

  return "default";
}

export function getRouteReadinessDisplay({
  route,
  routeError,
  status,
}: {
  readonly route: ProposalRouteExplanationDto | undefined;
  readonly routeError: Error | undefined;
  readonly status: ProposalStatus;
}): {
  readonly label: string;
  readonly tone: ProposalRouteDisplayTone;
} {
  if (isCompletedProposalStatus(status)) {
    return {
      label: "Lifecycle complete",
      tone: "success",
    };
  }

  if (isTerminalProposalStatus(status)) {
    return {
      label: "Terminal state",
      tone: getProposalStatusTone(status),
    };
  }

  if (!route) {
    return {
      label: routeError ? "Route unavailable" : "Route pending",
      tone: routeError ? "warning" : "muted",
    };
  }

  if (route.execution.executable) {
    return {
      label: "Route ready",
      tone: "success",
    };
  }

  return {
    label: "Route blocked",
    tone: hasTerminalBlockedReason(route.execution.blockedReasons)
      ? "danger"
      : "warning",
  };
}

export function getProposalNextActionContext({
  bodies,
  proposal,
  route,
  routeError,
}: {
  readonly bodies: readonly BodyDto[];
  readonly proposal: ProposalDto;
  readonly route: ProposalRouteExplanationDto | undefined;
  readonly routeError: Error | undefined;
}): ProposalNextActionContext {
  if (isCompletedProposalStatus(proposal.status)) {
    return {
      actor: "No further action",
      detail: "The indexed proposal lifecycle is complete.",
      label: "Complete",
      title: "Proposal executed",
      tone: "success",
    };
  }

  if (isTerminalProposalStatus(proposal.status)) {
    return {
      actor: "No standard action",
      detail: `Proposal is ${formatLabel(proposal.status)}.`,
      label: formatLabel(proposal.status),
      title: "Proposal is final",
      tone: "danger",
    };
  }

  if (!route) {
    return {
      actor: "Route endpoint",
      detail:
        routeError?.message ??
        "Approval, veto, timelock, and execution readiness need route data.",
      label: "Unknown",
      title: "Route state unavailable",
      tone: "warning",
    };
  }

  if (route.execution.executable) {
    return {
      actor: route.execution.executorBody
        ? getExecutorBodyLabel({
            bodies,
            bodyId: route.execution.executorBody,
            route,
          })
        : "Configured executor body",
      detail: "Approvals, veto checks, and timelock state allow execution.",
      label: "Execute",
      title: "Ready for execution",
      tone: "success",
    };
  }

  const firstReason = route.execution.blockedReasons[0];

  if (!firstReason) {
    return {
      actor: "Governance route",
      detail:
        "Execution is false, but the route explainer did not report a blocker.",
      label: "Check route",
      title: "Route needs review",
      tone: "warning",
    };
  }

  return contextFromBlockedReason(firstReason, route, bodies);
}

export function getRouteOverviewMetricLabel(status: ProposalStatus): string {
  return isTerminalProposalStatus(status) ? "Next action" : "Next blocker";
}

export function getRoutePanelDisplay(
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): RoutePanelDisplay {
  const terminal = isTerminalProposalStatus(route.status);
  const executionTone = getRouteExecutionTone(route);

  return {
    blockedReasonsSection: getRouteBlockedReasonsSectionDisplay(route.status),
    executionBadgeLabel: getRouteExecutionBadgeLabel(route),
    executionStateSummary: getRouteExecutionStateSummary(route, bodies),
    executionStateTitle: getRouteExecutionStateTitle(route),
    executionTone,
    heroBadgeLabel: getRouteHeroBadgeLabel(route),
    heroSummary: getRouteHeroSummary(route, bodies),
    heroTitle: getRouteHeroTitle(route),
    nextActionLabel: getRouteOverviewMetricLabel(route.status),
    nextActionSummary: getRouteNextActionSummary(route, bodies),
    terminal,
  };
}

export function getRouteExecutionBadgeLabel(
  route: ProposalRouteExplanationDto,
): string {
  if (isCompletedProposalStatus(route.status)) {
    return "Lifecycle complete";
  }

  if (isTerminalProposalStatus(route.status)) {
    return "Terminal state";
  }

  return route.execution.executable ? "Executable" : "Blocked";
}

export function getRouteHeroTitle(
  route: ProposalRouteExplanationDto,
): string {
  if (isCompletedProposalStatus(route.status)) {
    return "Proposal lifecycle is complete";
  }

  if (isTerminalProposalStatus(route.status)) {
    return "Proposal is in a terminal state";
  }

  return route.execution.executable
    ? "Execution eligibility is satisfied"
    : "Execution is currently blocked";
}

export function getRouteHeroBadgeLabel(
  route: ProposalRouteExplanationDto,
): string {
  if (isTerminalProposalStatus(route.status)) {
    return isCompletedProposalStatus(route.status)
      ? "Complete"
      : "No further action";
  }

  return route.execution.executable ? "Ready" : "Not ready";
}

export function getRouteExecutionStateTitle(
  route: ProposalRouteExplanationDto,
): string {
  if (isTerminalProposalStatus(route.status)) {
    return "No further execution action is available";
  }

  return route.execution.executable
    ? "The route is executable"
    : "The route is not executable yet";
}

export function getTerminalRouteSummary(
  route: ProposalRouteExplanationDto,
): string {
  if (isCompletedProposalStatus(route.status)) {
    return "The proposal has executed. Terminal route reasons mean it cannot be executed again, not that governance is actively blocked.";
  }

  return `Proposal is ${formatLabel(route.status)}. No standard route action is available.`;
}

export function getRouteExecutionTone(
  route: ProposalRouteExplanationDto,
): ProposalRouteDisplayTone {
  if (isCompletedProposalStatus(route.status)) {
    return "success";
  }

  if (isTerminalProposalStatus(route.status)) {
    return route.status === ProposalStatus.Vetoed ? "danger" : "muted";
  }

  if (route.execution.executable) {
    return "success";
  }

  return hasTerminalBlockedReason(route.execution.blockedReasons)
    ? "danger"
    : "warning";
}

export function getRouteBlockedReasonTone({
  reason,
  terminal,
}: {
  readonly reason: RouteBlockedReasonDto;
  readonly terminal: boolean;
}): ProposalRouteDisplayTone {
  return terminal ? "muted" : getActiveBlockedReasonTone(reason);
}

export function getRouteBlockedReasonsSectionDisplay(
  status: ProposalStatus,
): RouteBlockedReasonsSectionDisplay {
  if (isTerminalProposalStatus(status)) {
    return {
      description:
        "Machine-readable route reasons after completion; these are not active next-action blockers.",
      emptyMessage: "The route explainer did not report terminal route notes.",
      emptyTitle: "No terminal route notes",
      title: "Terminal Route Notes",
    };
  }

  return {
    description: "Machine-readable blockers with human explanations.",
    emptyMessage: "The route explainer did not report any active blockers.",
    emptyTitle: "No blocked reasons",
    title: "Blocked Reasons",
  };
}

export function getRouteHeroSummary(
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): string {
  if (isTerminalProposalStatus(route.status)) {
    return getTerminalRouteSummary(route);
  }

  if (route.execution.executable) {
    return "Approvals, veto checks, and timelock state all allow execution.";
  }

  return getBlockedSummary(route.execution.blockedReasons, route, bodies);
}

export function getRouteExecutionStateSummary(
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): string {
  if (isTerminalProposalStatus(route.status)) {
    return getTerminalRouteSummary(route);
  }

  return route.execution.executorBody
    ? `${getExecutorBodyLabel({
        bodies,
        bodyId: route.execution.executorBody,
        route,
      })} can execute when the route is eligible`
    : "No executor body was reported by the route explainer.";
}

export function getRouteNextActionSummary(
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): RouteNextActionSummary {
  if (isCompletedProposalStatus(route.status)) {
    return {
      value: "No further action",
      detail: "The indexed proposal lifecycle is complete.",
    };
  }

  if (isTerminalProposalStatus(route.status)) {
    return {
      value: "Terminal state",
      detail: `Proposal is ${formatLabel(route.status)}.`,
    };
  }

  if (route.execution.executable) {
    return {
      value: "Execute",
      detail: route.execution.executorBody
        ? `${getExecutorBodyLabel({
            bodies,
            bodyId: route.execution.executorBody,
            route,
          })} can execute`
        : "Route is executable",
    };
  }

  const firstReason = route.execution.blockedReasons[0];
  if (!firstReason) {
    return {
      value: "Check route",
      detail:
        "Execution is false, but the route explainer did not report a blocker",
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.MissingApproval) {
    return {
      value: "Approval needed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.Vetoed) {
    return {
      value: "Vetoed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.NotQueued) {
    return {
      value: "Queue needed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.TimelockNotSatisfied) {
    return {
      value: "Timelock active",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.PolicySnapshotMissing) {
    return {
      value: "Policy snapshot missing",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.AlreadyExecuted) {
    return {
      value: "Already executed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.Cancelled) {
    return {
      value: "Cancelled",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === RouteBlockedReasonCode.Expired) {
    return {
      value: "Expired",
      detail: firstReason.message,
    };
  }

  return {
    value: "Blocked",
    detail: firstReason.message,
  };
}

function contextFromBlockedReason(
  reason: RouteBlockedReasonDto,
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): ProposalNextActionContext {
  if (reason.code === RouteBlockedReasonCode.MissingApproval) {
    return {
      actor: reason.relatedBodyId
        ? getRelatedRouteBodyLabel({
            bodies,
            bodyId: reason.relatedBodyId,
            route,
            role: "Approver",
          })
        : "Required approval body",
      detail: formatRouteBlockedReasonMessage({
        bodies,
        reason,
        role: "Approver",
        route,
      }),
      label: "Approval",
      title: "Approval needed",
      tone: "warning",
    };
  }

  if (reason.code === RouteBlockedReasonCode.NotQueued) {
    return {
      actor: "Any authorized queue caller",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Queue",
      title: "Queue needed",
      tone: "warning",
    };
  }

  if (reason.code === RouteBlockedReasonCode.TimelockNotSatisfied) {
    return {
      actor: "No one yet",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Waiting",
      title: "Timelock active",
      tone: "warning",
    };
  }

  if (reason.code === RouteBlockedReasonCode.Vetoed) {
    return {
      actor: "No standard action",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Vetoed",
      title: "Execution blocked",
      tone: "danger",
    };
  }

  if (reason.code === RouteBlockedReasonCode.PolicySnapshotMissing) {
    return {
      actor: "Indexer/projection recovery",
      detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
      label: "Snapshot",
      title: "Policy snapshot missing",
      tone: "danger",
    };
  }

  return {
    actor: reason.relatedBodyId
      ? getRelatedRouteBodyLabel({
          bodies,
          bodyId: reason.relatedBodyId,
          route,
        })
      : "Governance route",
    detail: formatRouteBlockedReasonMessage({ bodies, reason, route }),
    label: "Blocked",
    title: formatLabel(reason.code),
    tone: getActiveBlockedReasonTone(reason),
  };
}

function getBlockedSummary(
  blockedReasons: readonly RouteBlockedReasonDto[],
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): string {
  if (blockedReasons.length === 0) {
    return "The route explainer has not reported a blocker, but execution is not currently eligible.";
  }

  if (blockedReasons.length === 1) {
    return formatRouteBlockedReasonMessage({
      bodies,
      reason: blockedReasons[0],
      role:
        blockedReasons[0].code === RouteBlockedReasonCode.MissingApproval
          ? "Approver"
          : undefined,
      route,
    });
  }

  return `${blockedReasons.length} blockers must be resolved before execution.`;
}

function getActiveBlockedReasonTone(
  reason: RouteBlockedReasonDto,
): ProposalRouteDisplayTone {
  return terminalBlockedReasonCodes.includes(reason.code)
    ? "danger"
    : "warning";
}

function hasTerminalBlockedReason(
  blockedReasons: readonly RouteBlockedReasonDto[],
): boolean {
  return blockedReasons.some((reason) =>
    terminalBlockedReasonCodes.includes(reason.code),
  );
}
