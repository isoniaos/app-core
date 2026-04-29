import { useEffect, useMemo, useState } from "react";
import type {
  ProposalDto,
  ProposalRouteExplanationDto,
  RouteBodyRequirementDto,
  RouteBodyVetoDto,
} from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import { useRuntimeConfig } from "../../config/runtime-config";
import type { MetadataRecord } from "../../metadata/types";
import {
  buildDemoExecution,
  inferDemoNumber,
} from "../../protocol/demo-proposal-action";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import { ProposalActionLifecycle } from "./ProposalActionLifecycle";
import {
  type IndexedProposalActionData,
  useProposalAction,
} from "./useProposalAction";

interface ProposalActionsPanelProps {
  readonly metadata?: MetadataRecord;
  readonly onIndexed?: (data: IndexedProposalActionData) => void;
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

export function ProposalActionsPanel({
  metadata,
  onIndexed,
  proposal,
  route,
  routeError,
}: ProposalActionsPanelProps): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const { busy, readiness, reset, runAction, transaction } = useProposalAction({
    proposal,
    onIndexed,
  });
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
  const inferredDemoNumber = useMemo(
    () =>
      inferDemoNumber({
        proposal,
        textHints: [
          metadata?.title,
          metadata?.name,
          metadata?.description,
          proposal.title,
          proposal.descriptionUri,
        ],
      }),
    [metadata, proposal],
  );
  const [demoNumber, setDemoNumber] = useState(inferredDemoNumber ?? "");
  const demoExecution = useMemo(
    () =>
      buildDemoExecution({
        demoTargetAddress: runtimeConfig.contracts.demoTargetAddress,
        demoNumber,
        proposal,
      }),
    [demoNumber, proposal, runtimeConfig.contracts.demoTargetAddress],
  );

  useEffect(() => {
    setApprovalBodyId((current) =>
      selectValidBodyId(current, pendingApprovalBodies),
    );
  }, [pendingApprovalBodies]);

  useEffect(() => {
    setVetoBodyId((current) => selectValidBodyId(current, availableVetoBodies));
  }, [availableVetoBodies]);

  useEffect(() => {
    setDemoNumber((current) =>
      current.trim().length > 0 ? current : inferredDemoNumber ?? "",
    );
  }, [inferredDemoNumber]);

  const writeActionsEnabled = runtimeConfig.features.writeActions;
  const disableWrites = busy || !writeActionsEnabled;
  const showApprove =
    isApprovableStatus(proposal.status) && pendingApprovalBodies.length > 0;
  const showVeto =
    isVetoableStatus(proposal.status) && availableVetoBodies.length > 0;
  const showQueue = proposal.status === ProposalStatus.Approved;
  const showExecute =
    isExecutableStatus(proposal.status) && route?.execution.executable === true;
  const showCancel = isCancellableStatus(proposal.status);
  const hasVisibleAction =
    showApprove || showVeto || showQueue || showExecute || showCancel;

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
                onChange={(event) => setDemoNumber(event.target.value)}
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
            description="Cancel a proposal if the connected wallet is authorized."
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
              Current status is {formatLabel(proposal.status)}. The contract
              may still reject actions even when a button is visible.
            </span>
          </div>
        ) : null}
      </div>

      <ProposalActionLifecycle reset={reset} transaction={transaction} />
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
