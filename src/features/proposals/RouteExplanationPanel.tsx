import type { ProposalRouteExplanationDto } from "@isonia/types";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
} from "../../utils/format";

interface RouteExplanationPanelProps {
  readonly route: ProposalRouteExplanationDto;
}

export function RouteExplanationPanel({
  route,
}: RouteExplanationPanelProps): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Route</h2>
        <StatusBadge tone={route.execution.executable ? "success" : "warning"}>
          {route.execution.executable ? "Executable" : "Blocked"}
        </StatusBadge>
      </div>

      <div className="route-grid">
        <section>
          <h3>Approvals</h3>
          <div className="list-stack">
            {route.requiredApprovalBodies.length === 0 ? (
              <p className="empty-copy">No approval bodies required.</p>
            ) : (
              route.requiredApprovalBodies.map((body) => (
                <div className="list-row" key={body.bodyId}>
                  <div>
                    <strong>{body.bodyName}</strong>
                    <span>
                      {body.approvedBy
                        ? `${formatAddress(body.approvedBy)} - ${formatChainTime(
                            body.approvedAtChain,
                          )}`
                        : "Pending"}
                    </span>
                  </div>
                  <StatusBadge tone={body.approved ? "success" : "warning"}>
                    {body.approved ? "Approved" : "Pending"}
                  </StatusBadge>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h3>Veto</h3>
          <div className="list-stack">
            {route.vetoBodies.length === 0 ? (
              <p className="empty-copy">No veto bodies configured.</p>
            ) : (
              route.vetoBodies.map((body) => (
                <div className="list-row" key={body.bodyId}>
                  <div>
                    <strong>{body.bodyName}</strong>
                    <span>
                      {body.vetoedBy
                        ? `${formatAddress(body.vetoedBy)} - ${formatChainTime(
                            body.vetoedAtChain,
                          )}`
                        : "Not vetoed"}
                    </span>
                  </div>
                  <StatusBadge tone={body.vetoed ? "danger" : "muted"}>
                    {body.vetoed ? "Vetoed" : "Clear"}
                  </StatusBadge>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <dl className="detail-list detail-list-wide">
        <div>
          <dt>Timelock</dt>
          <dd>
            {route.timelock.required
              ? `${route.timelock.seconds}s`
              : "Not required"}
          </dd>
        </div>
        <div>
          <dt>Queued</dt>
          <dd>{formatChainTime(route.timelock.queuedAtChain)}</dd>
        </div>
        <div>
          <dt>Executable at</dt>
          <dd>{formatChainTime(route.timelock.executableAtChain)}</dd>
        </div>
        <div>
          <dt>Executor body</dt>
          <dd>{route.execution.executorBody ?? "Any configured executor"}</dd>
        </div>
      </dl>

      {route.execution.blockedReasons.length > 0 ? (
        <div className="callout-list">
          {route.execution.blockedReasons.map((reason) => (
            <div className="callout" key={`${reason.code}:${reason.message}`}>
              <strong>{formatLabel(reason.code)}</strong>
              <span>{reason.message}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

