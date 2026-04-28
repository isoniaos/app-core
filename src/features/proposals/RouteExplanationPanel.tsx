import type {
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

export type RouteFallbackContext = Pick<
  ProposalRouteExplanationDto,
  "chainId" | "orgId" | "policyVersion" | "proposalId" | "proposalType" | "status"
>;

interface RouteExplanationPanelProps {
  readonly fallback: RouteFallbackContext;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

export function RouteExplanationPanel({
  fallback,
  route,
  routeError,
}: RouteExplanationPanelProps): JSX.Element {
  if (!route) {
    return <MissingRoutePanel fallback={fallback} routeError={routeError} />;
  }

  const approvalCounts = getApprovalCounts(route.requiredApprovalBodies);
  const vetoCounts = getVetoCounts(route.vetoBodies);
  const blockedReasons = route.execution.blockedReasons;
  const executionTone = getExecutionTone(route);

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
            {route.execution.executable ? "Executable" : "Blocked"}
          </StatusBadge>
        </div>
      </div>

      <div className={`route-status-hero route-status-hero-${executionTone}`}>
        <div>
          <strong>
            {route.execution.executable
              ? "Execution eligibility is satisfied"
              : "Execution is currently blocked"}
          </strong>
          <p>
            {route.execution.executable
              ? "Approvals, veto checks, and timelock state all allow execution."
              : getBlockedSummary(blockedReasons)}
          </p>
        </div>
        <StatusBadge tone={executionTone}>
          {route.execution.executable ? "Ready" : "Not ready"}
        </StatusBadge>
      </div>

      <RouteSection
        title="Route Summary"
        description="Current proposal route state from the indexed policy snapshot."
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
              <ApprovalRow body={body} key={body.bodyId} />
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
              <VetoRow body={body} key={body.bodyId} />
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
            {route.execution.executable ? "Executable" : "Blocked"}
          </StatusBadge>
          <div>
            <strong>
              {route.execution.executable
                ? "The route is executable"
                : "The route is not executable yet"}
            </strong>
            <span>
              {route.execution.executorBody
                ? `Executor body #${route.execution.executorBody}`
                : "No executor body was reported by the route explainer."}
            </span>
          </div>
        </div>
      </RouteSection>

      <RouteSection
        title="Blocked Reasons"
        description="Machine-readable blockers with human explanations."
      >
        {blockedReasons.length === 0 ? (
          <RouteEmptyState
            title="No blocked reasons"
            message="The route explainer did not report any active blockers."
          />
        ) : (
          <div className="blocked-reason-list">
            {blockedReasons.map((reason) => (
              <BlockedReason reason={reason} key={getReasonKey(reason)} />
            ))}
          </div>
        )}
      </RouteSection>

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
                ? `Body #${route.execution.executorBody}`
                : "Not reported"
            }
          />
        </dl>
      </RouteSection>
    </section>
  );
}

function MissingRoutePanel({
  fallback,
  routeError,
}: {
  readonly fallback: RouteFallbackContext;
  readonly routeError?: Error;
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
  body,
}: {
  readonly body: RouteBodyRequirementDto;
}): JSX.Element {
  return (
    <div className="route-list-row">
      <div className="route-row-main">
        <strong>{getBodyName(body.bodyName, body.bodyId)}</strong>
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

function VetoRow({ body }: { readonly body: RouteBodyVetoDto }): JSX.Element {
  return (
    <div className="route-list-row">
      <div className="route-row-main">
        <strong>{getBodyName(body.bodyName, body.bodyId)}</strong>
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
  reason,
}: {
  readonly reason: RouteBlockedReasonDto;
}): JSX.Element {
  const tone = getBlockedReasonTone(reason);

  return (
    <div className={`blocked-reason blocked-reason-${tone}`}>
      <div className="blocked-reason-header">
        <strong>{formatLabel(reason.code)}</strong>
        <StatusBadge tone={tone}>{reason.code}</StatusBadge>
      </div>
      <span>{reason.message}</span>
      {reason.relatedBodyId ? (
        <small>Related body #{reason.relatedBodyId}</small>
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

function getExecutionTone(route: ProposalRouteExplanationDto): BadgeTone {
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
): string {
  if (blockedReasons.length === 0) {
    return "The route explainer has not reported a blocker, but execution is not currently eligible.";
  }

  if (blockedReasons.length === 1) {
    return blockedReasons[0].message;
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

function getBodyName(bodyName: string, bodyId: string): string {
  const trimmed = bodyName.trim();
  return trimmed.length > 0 ? trimmed : `Body #${bodyId}`;
}

function getReasonKey(reason: RouteBlockedReasonDto): string {
  return `${reason.code}:${reason.relatedBodyId ?? "none"}:${reason.message}`;
}
