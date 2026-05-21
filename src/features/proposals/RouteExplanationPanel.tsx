import type {
  BodyDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
  RouteBodyRequirementDto,
  RouteBodyVetoDto,
} from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
} from "../../utils/format";
import {
  formatRouteBlockedReasonMessage,
  getApprovalBodyLabel,
  getExecutorBodyLabel,
  getRelatedRouteBodyLabel,
  getVetoBodyLabel,
  type ProposalBodyActionRole,
} from "./proposal-body-labels";
import {
  isCompletedProposalStatus,
  isTerminalProposalStatus,
} from "./proposal-status-helpers";

export type RouteFallbackContext = Pick<
  ProposalRouteExplanationDto,
  "chainId" | "orgId" | "policyVersion" | "proposalId" | "proposalType" | "status"
>;

interface RouteExplanationPanelProps {
  readonly bodies?: readonly BodyDto[];
  readonly fallback: RouteFallbackContext;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly showTechnicalDetails?: boolean;
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

export function RouteExplanationPanel({
  bodies = [],
  fallback,
  route,
  routeError,
  showTechnicalDetails = true,
}: RouteExplanationPanelProps): JSX.Element {
  if (!route) {
    return (
      <MissingRoutePanel
        fallback={fallback}
        routeError={routeError}
        showTechnicalDetails={showTechnicalDetails}
      />
    );
  }

  const approvalCounts = getApprovalCounts(route.requiredApprovalBodies);
  const vetoCounts = getVetoCounts(route.vetoBodies);
  const blockedReasons = route.execution.blockedReasons;
  const executionTone = getExecutionTone(route);
  const nextAction = getNextActionSummary(route, bodies);
  const terminal = isTerminalProposalStatus(route.status);

  return (
    <section className="panel route-panel">
      <div className="panel-header">
        <div className="route-panel-heading">
          <h2>Proposal Route</h2>
          <span>Policy snapshot v{route.policyVersion}</span>
        </div>
        <div className="chip-row">
          <StatusBadge tone="muted">
            {formatLabel(route.proposalType)}
          </StatusBadge>
          <StatusBadge tone={executionTone}>
            {getExecutionBadgeLabel(route)}
          </StatusBadge>
        </div>
      </div>

      <div className={`route-status-hero route-status-hero-${executionTone}`}>
        <div>
          <strong>{getRouteHeroTitle(route)}</strong>
          <p>
            {terminal
              ? getTerminalRouteSummary(route)
              : route.execution.executable
                ? "Approvals, veto checks, and timelock state all allow execution."
                : getBlockedSummary(blockedReasons, route, bodies)}
          </p>
        </div>
        <StatusBadge tone={executionTone}>
          {getRouteHeroBadgeLabel(route)}
        </StatusBadge>
      </div>

      <RouteSection
        title="Route Summary"
        description="Read-only route state from the indexed policy snapshot."
      >
        <div className="route-summary-grid">
          <RouteSummaryItem
            label="Policy version"
            value={`v${route.policyVersion}`}
            detail="Snapshot used for this proposal"
          />
          <RouteSummaryItem
            label="Approvals"
            value={`${approvalCounts.approved}/${approvalCounts.total}`}
            detail={
              approvalCounts.total === 0
                ? "No approvals required"
                : "Required bodies approved"
            }
          />
          <RouteSummaryItem
            label="Veto checks"
            value={`${vetoCounts.clear}/${vetoCounts.total}`}
            detail={
              vetoCounts.total === 0
                ? "No veto bodies configured"
                : "Bodies clear of veto"
            }
          />
          <RouteSummaryItem
            label="Timelock"
            value={route.timelock.required ? "Required" : "None"}
            detail={getTimelockSummary(route)}
          />
          <RouteSummaryItem
            label="Executor"
            value={
              route.execution.executorBody
                ? getExecutorBodyLabel({
                    bodies,
                    bodyId: route.execution.executorBody,
                    route,
                  })
                : "Not reported"
            }
            detail="Body allowed to execute when the route is eligible"
          />
          <RouteSummaryItem
            label={terminal ? "Next action" : "Next blocker"}
            value={nextAction.value}
            detail={nextAction.detail}
          />
        </div>
      </RouteSection>

      <RouteSection
        title="Required Approvals"
        description="Bodies that must approve before the proposal can move forward."
      >
        {route.requiredApprovalBodies.length === 0 ? (
          <RouteEmptyState
            title="No required approvals"
            message="This policy snapshot does not require approval from any body."
          />
        ) : (
          <div className="route-list">
            {route.requiredApprovalBodies.map((body) => (
              <ApprovalRow bodies={bodies} body={body} key={body.bodyId} />
            ))}
          </div>
        )}
      </RouteSection>

      <RouteSection
        title="Veto Checks"
        description="Bodies that can stop execution under the proposal policy."
      >
        {route.vetoBodies.length === 0 ? (
          <RouteEmptyState
            title="No veto bodies"
            message="This policy snapshot does not assign veto power to any body."
          />
        ) : (
          <div className="route-list">
            {route.vetoBodies.map((body) => (
              <VetoRow bodies={bodies} body={body} key={body.bodyId} />
            ))}
          </div>
        )}
      </RouteSection>

      <RouteSection
        title="Timelock"
        description="Queue and delay state before execution can become available."
      >
        {!route.timelock.required ? (
          <RouteEmptyState
            title="No timelock"
            message="This proposal can execute without a queue delay once the rest of the route is satisfied."
          />
        ) : (
          <dl className="route-technical-grid">
            <RouteDetail
              label="Delay"
              value={formatDuration(route.timelock.seconds)}
            />
            <RouteDetail
              label="Queued"
              value={formatChainTime(route.timelock.queuedAtChain)}
            />
            <RouteDetail
              label="Executable at"
              value={formatChainTime(route.timelock.executableAtChain)}
            />
            <RouteDetail
              label="State"
              value={route.timelock.satisfied ? "Satisfied" : "Waiting"}
            />
          </dl>
        )}
      </RouteSection>

      <RouteSection
        title="Execution Eligibility"
        description="Whether the indexed route currently allows execution."
      >
        <div className="execution-state">
          <StatusBadge tone={executionTone}>
            {getExecutionBadgeLabel(route)}
          </StatusBadge>
          <div>
            <strong>{getExecutionStateTitle(route)}</strong>
            <span>
              {terminal
                ? getTerminalRouteSummary(route)
                : route.execution.executorBody
                ? `${getExecutorBodyLabel({
                    bodies,
                    bodyId: route.execution.executorBody,
                    route,
                  })} can execute when the route is eligible`
                : "No executor body was reported by the route explainer."}
            </span>
          </div>
        </div>
      </RouteSection>

      <RouteSection
        title={terminal ? "Terminal Route Notes" : "Blocked Reasons"}
        description={
          terminal
            ? "Machine-readable route reasons after completion; these are not active next-action blockers."
            : "Machine-readable blockers with human explanations."
        }
      >
        {blockedReasons.length === 0 ? (
          <RouteEmptyState
            title={terminal ? "No terminal route notes" : "No blocked reasons"}
            message={
              terminal
                ? "The route explainer did not report terminal route notes."
                : "The route explainer did not report any active blockers."
            }
          />
        ) : (
          <div className="blocked-reason-list">
            {blockedReasons.map((reason) => (
              <BlockedReason
                bodies={bodies}
                terminal={terminal}
                reason={reason}
                route={route}
                key={getReasonKey(reason)}
              />
            ))}
          </div>
        )}
      </RouteSection>

      {showTechnicalDetails ? (
        <RouteSection
          title="Technical Details"
          description="Stable identifiers from the route explanation DTO."
        >
          <dl className="route-technical-grid">
            <RouteDetail label="Chain ID" value={String(route.chainId)} />
            <RouteDetail label="Org ID" value={route.orgId} />
            <RouteDetail label="Proposal ID" value={route.proposalId} />
            <RouteDetail
              label="Proposal type"
              value={formatLabel(route.proposalType)}
            />
            <RouteDetail
              label="Proposal status"
              value={formatLabel(route.status)}
            />
            <RouteDetail
              label="Executor body"
              value={
                route.execution.executorBody
                  ? getExecutorBodyLabel({
                      bodies,
                      bodyId: route.execution.executorBody,
                      route,
                    })
                  : "Not reported"
              }
            />
          </dl>
        </RouteSection>
      ) : null}
    </section>
  );
}

function MissingRoutePanel({
  fallback,
  routeError,
  showTechnicalDetails,
}: {
  readonly fallback: RouteFallbackContext;
  readonly routeError?: Error;
  readonly showTechnicalDetails: boolean;
}): JSX.Element {
  return (
    <section className="panel route-panel">
      <div className="panel-header">
        <div className="route-panel-heading">
          <h2>Proposal Route</h2>
          <span>Policy snapshot v{fallback.policyVersion}</span>
        </div>
        <StatusBadge tone="warning">Route unavailable</StatusBadge>
      </div>

      <RouteSection
        title="Missing Route Data"
        description="The proposal was loaded, but the route explanation endpoint did not return usable data."
      >
        <div className="route-missing-state">
          <strong>Route explanation unavailable</strong>
          <span>
            {routeError?.message ??
              "No route explanation was returned for this proposal."}
          </span>
        </div>
      </RouteSection>

      {showTechnicalDetails ? (
        <RouteSection
          title="Technical Details"
          description="Fallback identifiers from the proposal details response."
        >
          <dl className="route-technical-grid">
            <RouteDetail label="Chain ID" value={String(fallback.chainId)} />
            <RouteDetail label="Org ID" value={fallback.orgId} />
            <RouteDetail label="Proposal ID" value={fallback.proposalId} />
            <RouteDetail
              label="Proposal type"
              value={formatLabel(fallback.proposalType)}
            />
            <RouteDetail
              label="Proposal status"
              value={formatLabel(fallback.status)}
            />
            <RouteDetail
              label="Policy version"
              value={`v${fallback.policyVersion}`}
            />
          </dl>
        </RouteSection>
      ) : null}
    </section>
  );
}

function RouteSection({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="route-section">
      <div className="route-section-header">
        <div className="route-section-title">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function RouteSummaryItem({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}): JSX.Element {
  return (
    <div className="route-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ApprovalRow({
  bodies,
  body,
}: {
  readonly bodies: readonly BodyDto[];
  readonly body: RouteBodyRequirementDto;
}): JSX.Element {
  return (
    <div className="route-list-row">
      <div className="route-row-main">
        <strong>{getApprovalBodyLabel({ bodies, body })}</strong>
        <span>
          {body.approvedBy
            ? `${formatAddress(body.approvedBy)} - ${formatChainTime(
                body.approvedAtChain,
              )}`
            : "Awaiting approval"}
        </span>
        {body.txHash ? <code>{body.txHash}</code> : null}
      </div>
      <StatusBadge tone={body.approved ? "success" : "warning"}>
        {body.approved ? "Approved" : "Pending"}
      </StatusBadge>
    </div>
  );
}

function VetoRow({
  bodies,
  body,
}: {
  readonly bodies: readonly BodyDto[];
  readonly body: RouteBodyVetoDto;
}): JSX.Element {
  return (
    <div className="route-list-row">
      <div className="route-row-main">
        <strong>{getVetoBodyLabel({ bodies, body })}</strong>
        <span>
          {body.vetoedBy
            ? `${formatAddress(body.vetoedBy)} - ${formatChainTime(
                body.vetoedAtChain,
              )}`
            : "No veto recorded"}
        </span>
        {body.txHash ? <code>{body.txHash}</code> : null}
      </div>
      <StatusBadge tone={body.vetoed ? "danger" : "success"}>
        {body.vetoed ? "Vetoed" : "Clear"}
      </StatusBadge>
    </div>
  );
}

function RouteEmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}): JSX.Element {
  return (
    <div className="route-empty-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function BlockedReason({
  bodies,
  terminal,
  reason,
  route,
}: {
  readonly bodies: readonly BodyDto[];
  readonly terminal: boolean;
  readonly reason: RouteBlockedReasonDto;
  readonly route: ProposalRouteExplanationDto;
}): JSX.Element {
  const tone = terminal ? "muted" : getBlockedReasonTone(reason);
  const role = getBlockedReasonBodyRole(reason);

  return (
    <div className={`blocked-reason blocked-reason-${tone}`}>
      <div className="blocked-reason-header">
        <strong>{formatLabel(reason.code)}</strong>
        <StatusBadge tone={tone}>{reason.code}</StatusBadge>
      </div>
      <span>
        {formatRouteBlockedReasonMessage({
          bodies,
          reason,
          role,
          route,
        })}
      </span>
      {reason.relatedBodyId ? (
        <small>
          Related{" "}
          {getRelatedRouteBodyLabel({
            bodies,
            bodyId: reason.relatedBodyId,
            route,
            role,
          })}
        </small>
      ) : null}
    </div>
  );
}

function RouteDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getApprovalCounts(
  approvals: readonly RouteBodyRequirementDto[],
): { readonly approved: number; readonly total: number } {
  return {
    approved: approvals.filter((body) => body.approved).length,
    total: approvals.length,
  };
}

function getVetoCounts(
  vetoBodies: readonly RouteBodyVetoDto[],
): { readonly clear: number; readonly total: number } {
  return {
    clear: vetoBodies.filter((body) => !body.vetoed).length,
    total: vetoBodies.length,
  };
}

function getExecutionBadgeLabel(route: ProposalRouteExplanationDto): string {
  if (isCompletedProposalStatus(route.status)) {
    return "Lifecycle complete";
  }

  if (isTerminalProposalStatus(route.status)) {
    return "Terminal state";
  }

  return route.execution.executable ? "Executable" : "Blocked";
}

function getRouteHeroTitle(route: ProposalRouteExplanationDto): string {
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

function getRouteHeroBadgeLabel(route: ProposalRouteExplanationDto): string {
  if (isTerminalProposalStatus(route.status)) {
    return isCompletedProposalStatus(route.status)
      ? "Complete"
      : "No further action";
  }

  return route.execution.executable ? "Ready" : "Not ready";
}

function getExecutionStateTitle(route: ProposalRouteExplanationDto): string {
  if (isTerminalProposalStatus(route.status)) {
    return "No further execution action is available";
  }

  return route.execution.executable
    ? "The route is executable"
    : "The route is not executable yet";
}

function getTerminalRouteSummary(route: ProposalRouteExplanationDto): string {
  if (isCompletedProposalStatus(route.status)) {
    return "The proposal has executed. Terminal route reasons mean it cannot be executed again, not that governance is actively blocked.";
  }

  return `Proposal is ${formatLabel(route.status)}. No standard route action is available.`;
}

function getExecutionTone(route: ProposalRouteExplanationDto): BadgeTone {
  if (isCompletedProposalStatus(route.status)) {
    return "success";
  }

  if (isTerminalProposalStatus(route.status)) {
    return route.status === ProposalStatus.Vetoed ? "danger" : "muted";
  }

  if (route.execution.executable) {
    return "success";
  }

  return route.execution.blockedReasons.some((reason) =>
    ["vetoed", "already_executed", "cancelled", "expired"].includes(
      reason.code,
    ),
  )
    ? "danger"
    : "warning";
}

function getBlockedReasonTone(reason: RouteBlockedReasonDto): BadgeTone {
  return ["vetoed", "already_executed", "cancelled", "expired"].includes(
    reason.code,
  )
    ? "danger"
    : "warning";
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
        blockedReasons[0].code === "missing_approval" ? "Approver" : undefined,
      route,
    });
  }

  return `${blockedReasons.length} blockers must be resolved before execution.`;
}

function getTimelockSummary(route: ProposalRouteExplanationDto): string {
  if (!route.timelock.required) {
    return "No delay configured";
  }

  return route.timelock.satisfied
    ? `${formatDuration(route.timelock.seconds)} satisfied`
    : `${formatDuration(route.timelock.seconds)} pending`;
}

function getNextActionSummary(
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
): {
  readonly detail: string;
  readonly value: string;
} {
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

  if (firstReason.code === "missing_approval") {
    return {
      value: "Approval needed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "vetoed") {
    return {
      value: "Vetoed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "not_queued") {
    return {
      value: "Queue needed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "timelock_not_satisfied") {
    return {
      value: "Timelock active",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "policy_snapshot_missing") {
    return {
      value: "Policy snapshot missing",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "already_executed") {
    return {
      value: "Already executed",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "cancelled") {
    return {
      value: "Cancelled",
      detail: firstReason.message,
    };
  }

  if (firstReason.code === "expired") {
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

function formatDuration(value: string): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return `${value}s`;
  }

  if (seconds === 0) {
    return "0s";
  }

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainderSeconds = seconds % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (remainderSeconds > 0 || parts.length === 0) {
    parts.push(`${remainderSeconds}s`);
  }

  return parts.join(" ");
}

function getReasonKey(reason: RouteBlockedReasonDto): string {
  return `${reason.code}:${reason.relatedBodyId ?? "none"}:${reason.message}`;
}

function getBlockedReasonBodyRole(
  reason: RouteBlockedReasonDto,
): ProposalBodyActionRole | undefined {
  if (reason.code === "missing_approval") {
    return "Approver";
  }
  return undefined;
}
