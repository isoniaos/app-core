import type {
  BodyDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
  RouteBodyRequirementDto,
  RouteBodyVetoDto,
} from "@isonia/types";
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
  getRouteBlockedReasonTone,
  getRoutePanelDisplay,
} from "./proposal-route-display";

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
  const display = getRoutePanelDisplay(route, bodies);
  const executionTone = display.executionTone;
  const nextAction = display.nextActionSummary;
  const terminal = display.terminal;

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
            {display.executionBadgeLabel}
          </StatusBadge>
        </div>
      </div>

      <div className={`route-status-hero route-status-hero-${executionTone}`}>
        <div>
          <strong>{display.heroTitle}</strong>
          <p>{display.heroSummary}</p>
        </div>
        <StatusBadge tone={executionTone}>
          {display.heroBadgeLabel}
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
            label={display.nextActionLabel}
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
            {display.executionBadgeLabel}
          </StatusBadge>
          <div>
            <strong>{display.executionStateTitle}</strong>
            <span>{display.executionStateSummary}</span>
          </div>
        </div>
      </RouteSection>

      <RouteSection
        title={display.blockedReasonsSection.title}
        description={display.blockedReasonsSection.description}
      >
        {blockedReasons.length === 0 ? (
          <RouteEmptyState
            title={display.blockedReasonsSection.emptyTitle}
            message={display.blockedReasonsSection.emptyMessage}
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
  const tone = getRouteBlockedReasonTone({ reason, terminal });
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

function getTimelockSummary(route: ProposalRouteExplanationDto): string {
  if (!route.timelock.required) {
    return "No delay configured";
  }

  return route.timelock.satisfied
    ? `${formatDuration(route.timelock.seconds)} satisfied`
    : `${formatDuration(route.timelock.seconds)} pending`;
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
