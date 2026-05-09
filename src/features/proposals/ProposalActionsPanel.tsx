import { useEffect, useMemo, useState } from "react";
import type {
  ProposalDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
  RouteBodyRequirementDto,
  RouteBodyVetoDto,
} from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import { useRuntimeConfig } from "../../config/runtime-config";
import type { DemoExecutionState } from "../../protocol/demo-proposal-action";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import { ProposalActionLifecycle } from "./ProposalActionLifecycle";
import {
  type ProposalActionReadiness,
  type ProposalActionRequest,
  type ProposalActionTransaction,
} from "./useProposalAction";

interface ProposalActionsPanelProps {
  readonly busy: boolean;
  readonly demoExecution: DemoExecutionState;
  readonly demoNumber: string;
  readonly onDemoNumberChange: (value: string) => void;
  readonly proposal: ProposalDto;
  readonly readiness?: ProposalActionReadiness;
  readonly reset: () => void;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly runAction: (request: ProposalActionRequest) => Promise<void>;
  readonly transaction: ProposalActionTransaction;
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

export function ProposalActionsPanel({
  busy,
  demoExecution,
  demoNumber,
  onDemoNumberChange,
  proposal,
  readiness,
  reset,
  route,
  routeError,
  runAction,
  transaction,
}: ProposalActionsPanelProps): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const pendingApprovalBodies = useMemo(
    () =>
      route?.requiredApprovalBodies.filter((body) => !body.approved) ?? [],
    [route],
  );
  const availableVetoBodies = useMemo(
    () => route?.vetoBodies.filter((body) => !body.vetoed) ?? [],
    [route],
  );
  const [approvalBodyId, setApprovalBodyId] = useState("");
  const [vetoBodyId, setVetoBodyId] = useState("");

  useEffect(() => {
    setApprovalBodyId((current) =>
      selectValidBodyId(current, pendingApprovalBodies),
    );
  }, [pendingApprovalBodies]);

  useEffect(() => {
    setVetoBodyId((current) => selectValidBodyId(current, availableVetoBodies));
  }, [availableVetoBodies]);

  const writeActionsEnabled = runtimeConfig.features.writeActions;
  const disableWrites = busy || Boolean(readiness);
  const showApprove =
    isApprovableStatus(proposal.status) && pendingApprovalBodies.length > 0;
  const showVeto =
    isVetoableStatus(proposal.status) && availableVetoBodies.length > 0;
  const showQueue =
    proposal.status === ProposalStatus.Approved &&
    route?.timelock.required === true;
  const showExecute =
    isExecutableStatus(proposal.status) && route?.execution.executable === true;
  const showCancel = isCancellableStatus(proposal.status);
  const hasVisibleAction =
    showApprove || showVeto || showQueue || showExecute || showCancel;
  const actionReadiness = getActionReadiness({
    availableVetoBodies,
    demoExecutionReady: demoExecution.ready,
    pendingApprovalBodies,
    proposal,
    route,
    routeError,
  });

  return (
    <section className="panel proposal-actions-panel">
      <div className="panel-header">
        <div>
          <h2>Actions</h2>
          <p className="panel-subtitle">
            Submit proposal lifecycle transactions and wait for the Control
            Plane read model to catch up.
          </p>
        </div>
        <StatusBadge tone={writeActionsEnabled ? "success" : "muted"}>
          {writeActionsEnabled ? "Writes enabled" : "Writes disabled"}
        </StatusBadge>
      </div>

      {readiness ? (
        <div className="inline-state inline-state-muted write-flow-alert">
          <strong>{readiness.title}</strong>
          <span>{readiness.message}</span>
        </div>
      ) : null}

      {!route ? (
        <div className="inline-state inline-state-muted write-flow-alert">
          <strong>Route state unavailable</strong>
          <span>
            {routeError?.message ??
              "Approval, veto, and execution availability need the route endpoint."}
          </span>
        </div>
      ) : null}

      <div className="proposal-action-grid">
        <ActionReadinessSummary items={actionReadiness} />

        {showApprove ? (
          <ActionCard
            description="Approve through one required body. Contract mandate checks remain authoritative."
            tone="success"
            title="Approve"
          >
            <BodySelector
              bodies={pendingApprovalBodies}
              label="Approval body"
              value={approvalBodyId}
              onChange={setApprovalBodyId}
            />
            <button
              className="button button-primary"
              disabled={disableWrites || approvalBodyId.length === 0}
              type="button"
              onClick={() => {
                void runAction({ kind: "approve", bodyId: approvalBodyId });
              }}
            >
              Approve
            </button>
          </ActionCard>
        ) : null}

        {showVeto ? (
          <ActionCard
            description="Record a veto from a veto-capable body."
            tone="danger"
            title="Veto"
          >
            <BodySelector
              bodies={availableVetoBodies}
              label="Veto body"
              value={vetoBodyId}
              onChange={setVetoBodyId}
            />
            <button
              className="button"
              disabled={disableWrites || vetoBodyId.length === 0}
              type="button"
              onClick={() => {
                void runAction({ kind: "veto", bodyId: vetoBodyId });
              }}
            >
              Veto
            </button>
          </ActionCard>
        ) : null}

        {showQueue ? (
          <ActionCard
            description="Move an approved proposal into the queue and record its executable time."
            tone="warning"
            title="Queue"
          >
            <button
              className="button"
              disabled={disableWrites}
              type="button"
              onClick={() => {
                void runAction({ kind: "queue" });
              }}
            >
              Queue
            </button>
          </ActionCard>
        ) : null}

        {showExecute ? (
          <ActionCard
            description="Execute the configured demo action after the route is eligible."
            tone="success"
            title="Execute"
          >
            <label className="form-field proposal-action-field">
              <span>Demo number</span>
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={demoNumber}
                onChange={(event) => onDemoNumberChange(event.target.value)}
              />
            </label>
            <div className="proposal-action-note">
              <StatusBadge tone={demoExecution.ready ? "success" : "warning"}>
                {demoExecution.ready ? "Hash matched" : "Needs demo action"}
              </StatusBadge>
              <span>{demoExecution.message}</span>
            </div>
            <button
              className="button button-primary"
              disabled={disableWrites || !demoExecution.ready}
              type="button"
              onClick={() => {
                if (
                  !demoExecution.actionData ||
                  demoExecution.value === undefined
                ) {
                  return;
                }
                void runAction({
                  kind: "execute",
                  actionData: demoExecution.actionData,
                  value: demoExecution.value,
                });
              }}
            >
              Execute
            </button>
          </ActionCard>
        ) : null}

        {showCancel ? (
          <ActionCard
            description="Request cancellation. Contract authority is final: org admin can cancel, and the creator can cancel only before required approvals."
            tone="muted"
            title="Cancel"
          >
            <button
              className="button"
              disabled={disableWrites}
              type="button"
              onClick={() => {
                void runAction({ kind: "cancel" });
              }}
            >
              Cancel
            </button>
          </ActionCard>
        ) : null}

        {!hasVisibleAction ? (
          <div className="proposal-action-empty">
            <strong>No proposal actions available</strong>
            <span>
              Current status is {formatLabel(proposal.status)}. Review the
              action readiness rows above for the indexed route blocker.
            </span>
          </div>
        ) : null}
      </div>

      <ProposalActionLifecycle
        blockExplorerUrl={runtimeConfig.blockExplorerUrl}
        reset={reset}
        transaction={transaction}
      />
    </section>
  );
}

interface ActionReadinessItem {
  readonly detail: string;
  readonly label: string;
  readonly tone: BadgeTone;
  readonly value: string;
}

function ActionReadinessSummary({
  items,
}: {
  readonly items: readonly ActionReadinessItem[];
}): JSX.Element {
  return (
    <section className="proposal-action-readiness">
      <div className="proposal-action-readiness-header">
        <h3>Action Readiness</h3>
        <p>
          UI availability is a hint from indexed route state. Contract authority
          remains final when a transaction is submitted.
        </p>
      </div>
      <div className="proposal-action-readiness-list">
        {items.map((item) => (
          <div className="proposal-action-readiness-row" key={item.label}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
            <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionCard({
  children,
  description,
  title,
  tone,
}: {
  readonly children: React.ReactNode;
  readonly description: string;
  readonly title: string;
  readonly tone: BadgeTone;
}): JSX.Element {
  return (
    <section className="proposal-action-card">
      <div className="proposal-action-card-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <StatusBadge tone={tone}>{title}</StatusBadge>
      </div>
      <div className="proposal-action-card-body">{children}</div>
    </section>
  );
}

function BodySelector({
  bodies,
  label,
  onChange,
  value,
}: {
  readonly bodies: readonly (RouteBodyRequirementDto | RouteBodyVetoDto)[];
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  if (bodies.length === 1) {
    return (
      <div className="proposal-action-body-fixed">
        <span>{label}</span>
        <strong>{getBodyName(bodies[0])}</strong>
      </div>
    );
  }

  return (
    <label className="form-field proposal-action-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {bodies.map((body) => (
          <option key={body.bodyId} value={body.bodyId}>
            {getBodyName(body)}
          </option>
        ))}
      </select>
    </label>
  );
}

function selectValidBodyId(
  current: string,
  bodies: readonly (RouteBodyRequirementDto | RouteBodyVetoDto)[],
): string {
  if (bodies.some((body) => body.bodyId === current)) {
    return current;
  }
  return bodies[0]?.bodyId ?? "";
}

function getBodyName(body: RouteBodyRequirementDto | RouteBodyVetoDto): string {
  const name = body.bodyName.trim();
  return name.length > 0 ? name : `Body #${body.bodyId}`;
}

function getActionReadiness({
  availableVetoBodies,
  demoExecutionReady,
  pendingApprovalBodies,
  proposal,
  route,
  routeError,
}: {
  readonly availableVetoBodies: readonly RouteBodyVetoDto[];
  readonly demoExecutionReady: boolean;
  readonly pendingApprovalBodies: readonly RouteBodyRequirementDto[];
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): readonly ActionReadinessItem[] {
  return [
    getApproveReadiness(proposal, route, routeError, pendingApprovalBodies),
    getVetoReadiness(proposal, route, routeError, availableVetoBodies),
    getQueueReadiness(proposal, route, routeError),
    getExecuteReadiness(proposal, route, routeError, demoExecutionReady),
    getCancelReadiness(proposal),
  ];
}

function getApproveReadiness(
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
  pendingApprovalBodies: readonly RouteBodyRequirementDto[],
): ActionReadinessItem {
  if (isFinalStatus(proposal.status)) {
    return {
      label: "Approve",
      value: "Complete",
      tone: "muted",
      detail: `Proposal is ${formatLabel(proposal.status)}.`,
    };
  }

  if (!route) {
    return unavailableRouteReadiness("Approve", routeError);
  }

  if (pendingApprovalBodies.length > 0 && isApprovableStatus(proposal.status)) {
    return {
      label: "Approve",
      value: "Available",
      tone: "success",
      detail: `Waiting on ${formatBodyList(pendingApprovalBodies)}.`,
    };
  }

  if (route.requiredApprovalBodies.every((body) => body.approved)) {
    return {
      label: "Approve",
      value: "Complete",
      tone: "success",
      detail: "All required approval bodies have approved.",
    };
  }

  return {
    label: "Approve",
    value: "Blocked",
    tone: "warning",
    detail: `Current status ${formatLabel(
      proposal.status,
    )} does not accept approvals in this UI.`,
  };
}

function getVetoReadiness(
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
  availableVetoBodies: readonly RouteBodyVetoDto[],
): ActionReadinessItem {
  if (proposal.status === ProposalStatus.Vetoed) {
    return {
      label: "Veto",
      value: "Complete",
      tone: "danger",
      detail: "A veto has already been recorded.",
    };
  }

  if (isFinalStatus(proposal.status)) {
    return {
      label: "Veto",
      value: "Complete",
      tone: "muted",
      detail: `Proposal is ${formatLabel(proposal.status)}.`,
    };
  }

  if (!route) {
    return unavailableRouteReadiness("Veto", routeError);
  }

  if (route.vetoBodies.length === 0) {
    return {
      label: "Veto",
      value: "Not configured",
      tone: "muted",
      detail: "This policy snapshot has no veto bodies.",
    };
  }

  if (availableVetoBodies.length > 0 && isVetoableStatus(proposal.status)) {
    return {
      label: "Veto",
      value: "Available",
      tone: "success",
      detail: `Veto-capable bodies: ${formatBodyList(availableVetoBodies)}.`,
    };
  }

  return {
    label: "Veto",
    value: "Blocked",
    tone: "warning",
    detail: `Current status ${formatLabel(
      proposal.status,
    )} does not accept veto in this UI.`,
  };
}

function getQueueReadiness(
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
): ActionReadinessItem {
  if (proposal.status === ProposalStatus.Queued) {
    return {
      label: "Queue",
      value: "Complete",
      tone: "success",
      detail: "Proposal is already queued.",
    };
  }

  if (proposal.status === ProposalStatus.Executed) {
    return {
      label: "Queue",
      value: "Complete",
      tone: "muted",
      detail: "Proposal has already executed.",
    };
  }

  if (isBlockedFinalStatus(proposal.status)) {
    return {
      label: "Queue",
      value: "Blocked",
      tone: "danger",
      detail: `Proposal is ${formatLabel(proposal.status)}.`,
    };
  }

  if (!route) {
    return unavailableRouteReadiness("Queue", routeError);
  }

  if (!route.timelock.required) {
    return {
      label: "Queue",
      value: "Not required",
      tone: "muted",
      detail: "This policy snapshot has no timelock queue requirement.",
    };
  }

  if (proposal.status === ProposalStatus.Approved) {
    return {
      label: "Queue",
      value: "Available",
      tone: "success",
      detail: "Approvals are complete and the route requires a timelock.",
    };
  }

  return {
    label: "Queue",
    value: "Blocked",
    tone: "warning",
    detail: getBlockedReasonSummary(
      route.execution.blockedReasons,
      "Missing approval or earlier lifecycle step blocks queueing.",
    ),
  };
}

function getExecuteReadiness(
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
  demoExecutionReady: boolean,
): ActionReadinessItem {
  if (proposal.status === ProposalStatus.Executed) {
    return {
      label: "Execute",
      value: "Complete",
      tone: "success",
      detail: "Proposal is already executed.",
    };
  }

  if (isBlockedFinalStatus(proposal.status)) {
    return {
      label: "Execute",
      value: "Blocked",
      tone: "danger",
      detail: `Proposal is ${formatLabel(proposal.status)}.`,
    };
  }

  if (!route) {
    return unavailableRouteReadiness("Execute", routeError);
  }

  if (route.execution.executable && demoExecutionReady) {
    return {
      label: "Execute",
      value: "Available",
      tone: "success",
      detail: "Route is executable and the DemoTarget action hash matches.",
    };
  }

  if (route.execution.executable && !demoExecutionReady) {
    return {
      label: "Execute",
      value: "Needs demo input",
      tone: "warning",
      detail: "Route is executable, but the DemoTarget action input is not matched.",
    };
  }

  return {
    label: "Execute",
    value: "Blocked",
    tone: "warning",
    detail: getBlockedReasonSummary(
      route.execution.blockedReasons,
      "Route is not executable yet.",
    ),
  };
}

function getCancelReadiness(proposal: ProposalDto): ActionReadinessItem {
  if (isCancellableStatus(proposal.status)) {
    return {
      label: "Cancel",
      value: "Available",
      tone: "success",
      detail:
        "UI exposes cancel while the proposal is not final. Contract authority remains final.",
    };
  }

  return {
    label: "Cancel",
    value: "Complete",
    tone: "muted",
    detail: `Proposal is ${formatLabel(proposal.status)}.`,
  };
}

function unavailableRouteReadiness(
  label: string,
  routeError: Error | undefined,
): ActionReadinessItem {
  return {
    label,
    value: "Unknown",
    tone: "warning",
    detail:
      routeError?.message ??
      "Route explanation is unavailable, so indexed action availability cannot be determined.",
  };
}

function getBlockedReasonSummary(
  reasons: readonly RouteBlockedReasonDto[],
  fallback: string,
): string {
  return reasons[0]?.message ?? fallback;
}

function formatBodyList(
  bodies: readonly (RouteBodyRequirementDto | RouteBodyVetoDto)[],
): string {
  if (bodies.length === 0) {
    return "none";
  }

  return bodies.map(getBodyName).join(", ");
}

function isFinalStatus(status: ProposalStatus): boolean {
  return [
    ProposalStatus.Cancelled,
    ProposalStatus.Executed,
    ProposalStatus.Expired,
    ProposalStatus.Vetoed,
  ].includes(status);
}

function isBlockedFinalStatus(status: ProposalStatus): boolean {
  return [
    ProposalStatus.Cancelled,
    ProposalStatus.Expired,
    ProposalStatus.Vetoed,
  ].includes(status);
}

function isApprovableStatus(status: ProposalStatus): boolean {
  return (
    status === ProposalStatus.Created || status === ProposalStatus.UnderReview
  );
}

function isVetoableStatus(status: ProposalStatus): boolean {
  return ![
    ProposalStatus.Cancelled,
    ProposalStatus.Executed,
    ProposalStatus.Expired,
    ProposalStatus.Vetoed,
  ].includes(status);
}

function isExecutableStatus(status: ProposalStatus): boolean {
  return status === ProposalStatus.Approved || status === ProposalStatus.Queued;
}

function isCancellableStatus(status: ProposalStatus): boolean {
  return ![
    ProposalStatus.Cancelled,
    ProposalStatus.Executed,
    ProposalStatus.Expired,
    ProposalStatus.Vetoed,
  ].includes(status);
}
