import { useEffect, useMemo, useState } from "react";
import type {
  Address,
  BodyDto,
  MandateDto,
  ProposalDto,
  ProposalRouteExplanationDto,
  RouteBlockedReasonDto,
  RouteBodyRequirementDto,
  RouteBodyVetoDto,
  RoleDto,
} from "@isonia/types";
import { PROPOSAL_TYPE_CHAIN_MAP, ProposalStatus, RoleType } from "@isonia/types";
import { isAddress } from "viem";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useRuntimeConfig } from "../../config/runtime-config";
import type { DemoExecutionState } from "../../protocol/demo-proposal-action";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import { useWalletConnection } from "../../wallet/useWalletConnection";
import { ProposalActionLifecycle } from "./ProposalActionLifecycle";
import {
  formatRouteBlockedReasonMessage,
  formatBodyList as formatLabeledBodyList,
  getApprovalBodyLabel,
  getBodyActionLabel,
  getExecutorBodyLabel,
  getVetoBodyLabel,
  type ProposalBodyActionRole,
} from "./proposal-body-labels";
import {
  type ProposalActionReadiness,
  type ProposalActionRequest,
  type ProposalActionTransaction,
} from "./useProposalAction";

interface ProposalActionsPanelProps {
  readonly bodies: readonly BodyDto[];
  readonly busy: boolean;
  readonly demoExecution: DemoExecutionState;
  readonly demoNumber: string;
  readonly onDemoNumberChange: (value: string) => void;
  readonly orgAdminAddress?: string;
  readonly proposal: ProposalDto;
  readonly readiness?: ProposalActionReadiness;
  readonly reset: () => void;
  readonly roles: readonly RoleDto[];
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly runAction: (request: ProposalActionRequest) => Promise<void>;
  readonly transaction: ProposalActionTransaction;
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

interface HolderMandatesState {
  readonly accountAddress?: Address;
  readonly connected: boolean;
  readonly error?: Error;
  readonly loading: boolean;
  readonly mandates: readonly MandateDto[];
}

interface ActionDisabledState {
  readonly disabled: boolean;
  readonly reason?: string;
  readonly tone: "muted" | "warning" | "danger";
}

export function ProposalActionsPanel({
  bodies,
  busy,
  demoExecution,
  demoNumber,
  onDemoNumberChange,
  orgAdminAddress,
  proposal,
  readiness,
  reset,
  roles,
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
  const holderMandates = useConnectedHolderMandates(proposal.orgId);

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
  const showExecute = isExecutableStatus(proposal.status);
  const showCancel = isCancellableStatus(proposal.status);
  const hasVisibleAction =
    showApprove || showVeto || showQueue || showExecute || showCancel;
  const actionReadiness = getActionReadiness({
    availableVetoBodies,
    bodies,
    demoExecutionReady: demoExecution.ready,
    pendingApprovalBodies,
    proposal,
    route,
    routeError,
  });
  const selectedApprovalBody = pendingApprovalBodies.find(
    (body) => body.bodyId === approvalBodyId,
  );
  const selectedVetoBody = availableVetoBodies.find(
    (body) => body.bodyId === vetoBodyId,
  );
  const approveDisabled = getApproveDisabledState({
    authority: holderMandates,
    bodies,
    body: selectedApprovalBody,
    globalReadiness: readiness,
    roles,
    proposal,
    route,
    routeError,
    transaction,
  });
  const vetoDisabled = getVetoDisabledState({
    authority: holderMandates,
    bodies,
    body: selectedVetoBody,
    globalReadiness: readiness,
    roles,
    proposal,
    route,
    routeError,
    transaction,
  });
  const queueDisabled = getQueueDisabledState({
    globalReadiness: readiness,
    proposal,
    route,
    routeError,
    transaction,
  });
  const executeDisabled = getExecuteDisabledState({
    authority: holderMandates,
    bodies,
    demoExecutionReady: demoExecution.ready,
    globalReadiness: readiness,
    proposal,
    roles,
    route,
    routeError,
    transaction,
  });
  const cancelDisabled = getCancelDisabledState({
    authority: holderMandates,
    globalReadiness: readiness,
    orgAdminAddress,
    proposal,
    route,
    routeError,
    transaction,
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
              bodiesIndex={bodies}
              bodies={pendingApprovalBodies}
              label="Approval body"
              role="Approver"
              value={approvalBodyId}
              onChange={setApprovalBodyId}
            />
            <button
              className="button button-primary"
              disabled={disableWrites || approveDisabled.disabled}
              type="button"
              onClick={() => {
                void runAction({ kind: "approve", bodyId: approvalBodyId });
              }}
            >
              Approve
            </button>
            <ActionDisabledReason state={approveDisabled} />
          </ActionCard>
        ) : null}

        {showVeto ? (
          <ActionCard
            description="Record a veto from a veto-capable body."
            tone="danger"
            title="Veto"
          >
            <BodySelector
              bodiesIndex={bodies}
              bodies={availableVetoBodies}
              label="Veto body"
              role="Vetoer"
              value={vetoBodyId}
              onChange={setVetoBodyId}
            />
            <button
              className="button"
              disabled={disableWrites || vetoDisabled.disabled}
              type="button"
              onClick={() => {
                void runAction({ kind: "veto", bodyId: vetoBodyId });
              }}
            >
              Veto
            </button>
            <ActionDisabledReason state={vetoDisabled} />
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
              disabled={disableWrites || queueDisabled.disabled}
              type="button"
              onClick={() => {
                void runAction({ kind: "queue" });
              }}
            >
              Queue
            </button>
            <ActionDisabledReason state={queueDisabled} />
          </ActionCard>
        ) : null}

        {showExecute ? (
          <ActionCard
            description="Execute the current configured target action after the route is eligible."
            tone="success"
            title="Execute"
          >
            <label className="form-field proposal-action-field">
              <span>setNumber value</span>
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
                {demoExecution.ready ? "Hash matched" : "Needs action input"}
              </StatusBadge>
              <span>{demoExecution.message}</span>
            </div>
            <button
              className="button button-primary"
              disabled={disableWrites || executeDisabled.disabled}
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
            <ActionDisabledReason state={executeDisabled} />
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
              disabled={disableWrites || cancelDisabled.disabled}
              type="button"
              onClick={() => {
                void runAction({ kind: "cancel" });
              }}
            >
              Cancel
            </button>
            <ActionDisabledReason state={cancelDisabled} />
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

function ActionDisabledReason({
  state,
}: {
  readonly state: ActionDisabledState;
}): JSX.Element | null {
  if (!state.disabled || !state.reason) {
    return null;
  }

  return (
    <div
      className={`proposal-action-disabled-reason proposal-action-disabled-reason-${state.tone}`}
    >
      {state.reason}
    </div>
  );
}

function useConnectedHolderMandates(orgId: string): HolderMandatesState {
  const account = useWalletConnection();
  const client = useIsoniaClient();
  const accountAddress =
    account.address && isAddress(account.address)
      ? (account.address as Address)
      : undefined;
  const [state, setState] = useState<{
    readonly error?: Error;
    readonly loading: boolean;
    readonly mandates: readonly MandateDto[];
  }>({
    loading: false,
    mandates: [],
  });

  useEffect(() => {
    if (!accountAddress) {
      setState({ loading: false, mandates: [] });
      return;
    }

    let active = true;
    setState({ loading: true, mandates: [] });
    client
      .getHolderMandates(orgId, accountAddress)
      .then((mandates) => {
        if (active) {
          setState({ loading: false, mandates });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
            mandates: [],
          });
        }
      });

    return () => {
      active = false;
    };
  }, [accountAddress, client, orgId]);

  return {
    accountAddress,
    connected: account.isConnected,
    error: state.error,
    loading: state.loading,
    mandates: state.mandates,
  };
}

function getApproveDisabledState({
  authority,
  bodies,
  body,
  globalReadiness,
  proposal,
  roles,
  route,
  routeError,
  transaction,
}: {
  readonly authority: HolderMandatesState;
  readonly bodies: readonly BodyDto[];
  readonly body: RouteBodyRequirementDto | undefined;
  readonly globalReadiness?: ProposalActionReadiness;
  readonly proposal: ProposalDto;
  readonly roles: readonly RoleDto[];
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly transaction: ProposalActionTransaction;
}): ActionDisabledState {
  const globalState = getGlobalDisabledState(globalReadiness, transaction, "approve", body?.bodyId);
  if (globalState) {
    return globalState;
  }

  if (!route) {
    return disabled(
      routeError?.message ??
        "Route explanation is unavailable, so approval readiness cannot be confirmed.",
      "warning",
    );
  }

  if (!isApprovableStatus(proposal.status)) {
    return disabled(
      `Current status ${formatLabel(proposal.status)} no longer accepts approval.`,
      "muted",
    );
  }

  if (!body) {
    return disabled("Choose a required approval body.", "muted");
  }

  if (body.approved) {
    return disabled(
      `${getApprovalBodyLabel({ bodies, body })} has already approved.`,
      "muted",
    );
  }

  return getRoleAuthorityDisabledState({
    authority,
    bodyLabel: getApprovalBodyLabel({ bodies, body }),
    bodyId: body.bodyId,
    proposal,
    roleLabel: "Approver",
    roles,
    roleType: RoleType.Approver,
  });
}

function getVetoDisabledState({
  authority,
  bodies,
  body,
  globalReadiness,
  proposal,
  roles,
  route,
  routeError,
  transaction,
}: {
  readonly authority: HolderMandatesState;
  readonly bodies: readonly BodyDto[];
  readonly body: RouteBodyVetoDto | undefined;
  readonly globalReadiness?: ProposalActionReadiness;
  readonly proposal: ProposalDto;
  readonly roles: readonly RoleDto[];
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly transaction: ProposalActionTransaction;
}): ActionDisabledState {
  const globalState = getGlobalDisabledState(globalReadiness, transaction, "veto", body?.bodyId);
  if (globalState) {
    return globalState;
  }

  if (!route) {
    return disabled(
      routeError?.message ??
        "Route explanation is unavailable, so veto readiness cannot be confirmed.",
      "warning",
    );
  }

  if (!isVetoableStatus(proposal.status)) {
    return disabled(
      `Current status ${formatLabel(proposal.status)} no longer accepts veto.`,
      "muted",
    );
  }

  if (!body) {
    return disabled("Choose a veto-capable body.", "muted");
  }

  if (body.vetoed) {
    return disabled(
      `${getVetoBodyLabel({ bodies, body })} has already vetoed.`,
      "muted",
    );
  }

  return getRoleAuthorityDisabledState({
    authority,
    bodyLabel: getVetoBodyLabel({ bodies, body }),
    bodyId: body.bodyId,
    proposal,
    roleLabel: "Vetoer",
    roles,
    roleType: RoleType.Vetoer,
  });
}

function getQueueDisabledState({
  globalReadiness,
  proposal,
  route,
  routeError,
  transaction,
}: {
  readonly globalReadiness?: ProposalActionReadiness;
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly transaction: ProposalActionTransaction;
}): ActionDisabledState {
  const globalState = getGlobalDisabledState(globalReadiness, transaction, "queue");
  if (globalState) {
    return globalState;
  }

  if (!route) {
    return disabled(
      routeError?.message ??
        "Route explanation is unavailable, so queue readiness cannot be confirmed.",
      "warning",
    );
  }

  if (proposal.status !== ProposalStatus.Approved) {
    return disabled(
      `Queue is available only after approval. Current status is ${formatLabel(
        proposal.status,
      )}.`,
      "muted",
    );
  }

  if (!route.timelock.required) {
    return disabled("This route does not require queueing.", "muted");
  }

  return enabled("Queue can be submitted after approval; the contract checks lifecycle state.");
}

function getExecuteDisabledState({
  authority,
  bodies,
  demoExecutionReady,
  globalReadiness,
  proposal,
  roles,
  route,
  routeError,
  transaction,
}: {
  readonly authority: HolderMandatesState;
  readonly bodies: readonly BodyDto[];
  readonly demoExecutionReady: boolean;
  readonly globalReadiness?: ProposalActionReadiness;
  readonly proposal: ProposalDto;
  readonly roles: readonly RoleDto[];
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly transaction: ProposalActionTransaction;
}): ActionDisabledState {
  const globalState = getGlobalDisabledState(globalReadiness, transaction, "execute");
  if (globalState) {
    return globalState;
  }

  if (proposal.status === ProposalStatus.Executed) {
    return disabled("Proposal is already executed.", "muted");
  }

  if (!isExecutableStatus(proposal.status)) {
    return disabled(
      `Current status ${formatLabel(proposal.status)} is not executable.`,
      "muted",
    );
  }

  if (!route) {
    return disabled(
      routeError?.message ??
        "Route explanation is unavailable, so execution readiness cannot be confirmed.",
      "warning",
    );
  }

  if (!route.execution.executable) {
    return disabled(
      getBlockedReasonSummary(
        route,
        bodies,
        route.execution.blockedReasons,
        "Route is not executable yet.",
      ),
      "warning",
    );
  }

  if (!route.execution.executorBody) {
    return disabled(
      "Executor authority cannot be confirmed because the route read model did not report an executor body.",
      "warning",
    );
  }

  if (!demoExecutionReady) {
    return disabled(
      "Action input does not match this proposal data hash.",
      "warning",
    );
  }

  const authorityState = getRoleAuthorityDisabledState({
    authority,
    bodyLabel: getExecutorBodyLabel({
      bodies,
      bodyId: route.execution.executorBody,
      route,
    }),
    bodyId: route.execution.executorBody,
    proposal,
    roleLabel: "Executor",
    roles,
    roleType: RoleType.Executor,
  });

  if (authorityState.disabled) {
    return authorityState;
  }

  return authorityState;
}

function getCancelDisabledState({
  authority,
  globalReadiness,
  orgAdminAddress,
  proposal,
  route,
  routeError,
  transaction,
}: {
  readonly authority: HolderMandatesState;
  readonly globalReadiness?: ProposalActionReadiness;
  readonly orgAdminAddress?: string;
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
  readonly transaction: ProposalActionTransaction;
}): ActionDisabledState {
  const globalState = getGlobalDisabledState(globalReadiness, transaction, "cancel");
  if (globalState) {
    return globalState;
  }

  if (!isCancellableStatus(proposal.status)) {
    return disabled(`Proposal is ${formatLabel(proposal.status)}.`, "muted");
  }

  if (!authority.accountAddress) {
    return disabled("Connected wallet address is unavailable.", "warning");
  }

  if (orgAdminAddress && sameAddress(authority.accountAddress, orgAdminAddress)) {
    return enabled("Connected wallet is the indexed organization admin.");
  }

  if (!route) {
    return disabled(
      routeError?.message ??
        "Route explanation is unavailable, so creator cancel eligibility cannot be confirmed.",
      "warning",
    );
  }

  if (
    sameAddress(authority.accountAddress, proposal.creatorAddress) &&
    !route.requiredApprovalBodies.some((body) => body.approved)
  ) {
    return enabled("Connected wallet is the creator and no approval is indexed yet.");
  }

  return disabled(
    "Connected wallet is not the indexed org admin or the creator before approval.",
    "warning",
  );
}

function getRoleAuthorityDisabledState({
  authority,
  bodyLabel,
  bodyId,
  proposal,
  roleLabel,
  roles,
  roleType,
}: {
  readonly authority: HolderMandatesState;
  readonly bodyLabel: string;
  readonly bodyId: string;
  readonly proposal: ProposalDto;
  readonly roleLabel: ProposalBodyActionRole;
  readonly roles: readonly RoleDto[];
  readonly roleType: RoleType;
}): ActionDisabledState {
  if (!authority.connected) {
    return disabled("Connect a wallet before submitting this action.", "muted");
  }

  if (!authority.accountAddress) {
    return disabled("Connected wallet address is unavailable.", "warning");
  }

  if (authority.loading) {
    return disabled("Checking connected wallet authority.", "muted");
  }

  if (authority.error) {
    return disabled(
      `Authority cannot be confirmed from current read models: ${authority.error.message}`,
      "warning",
    );
  }

  const matchingRoles = roles.filter(
    (role) =>
      role.bodyId === bodyId && role.roleType === roleType && role.active,
  );

  if (matchingRoles.length === 0) {
    return disabled(
      `Authority cannot be confirmed because no active ${roleLabel} role is indexed for ${bodyLabel}.`,
      "warning",
    );
  }

  const matchingRoleIds = new Set(matchingRoles.map((role) => role.roleId));
  const hasAuthority = authority.mandates.some(
    (mandate) =>
      mandate.bodyId === bodyId &&
      matchingRoleIds.has(mandate.roleId) &&
      isActiveMandate(mandate) &&
      mandateCoversProposalType(mandate, proposal.proposalType),
  );

  if (!hasAuthority) {
    return disabled(
      `Connected wallet has no active ${roleLabel} mandate for ${bodyLabel}.`,
      "warning",
    );
  }

  return enabled(`Connected wallet has an active ${roleLabel} mandate.`);
}

function getGlobalDisabledState(
  readiness: ProposalActionReadiness | undefined,
  transaction: ProposalActionTransaction,
  action: ProposalActionRequest["kind"],
  bodyId?: string,
): ActionDisabledState | undefined {
  if (readiness) {
    return disabled(readiness.message, "muted");
  }

  if (isTransactionActive(transaction.stage)) {
    return disabled(
      transaction.stage === "confirmed_waiting_indexer"
        ? `${actionLabelForReason(action)} is waiting for Control Plane indexing.`
        : `${actionLabelForReason(action)} transaction is in progress.`,
      "warning",
    );
  }

  if (
    transaction.stage === "indexed" &&
    transaction.action === action &&
    (bodyId === undefined || transaction.bodyId === undefined || transaction.bodyId === bodyId)
  ) {
    return disabled(
      `${actionLabelForReason(action)} was indexed. Waiting for refreshed route state.`,
      "muted",
    );
  }

  return undefined;
}

function enabled(reason?: string): ActionDisabledState {
  return { disabled: false, reason, tone: "muted" };
}

function disabled(
  reason: string,
  tone: ActionDisabledState["tone"],
): ActionDisabledState {
  return { disabled: true, reason, tone };
}

function isTransactionActive(stage: ProposalActionTransaction["stage"]): boolean {
  return (
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "confirmed_waiting_indexer"
  );
}

function actionLabelForReason(action: ProposalActionRequest["kind"]): string {
  if (action === "approve") {
    return "Approval";
  }
  if (action === "veto") {
    return "Veto";
  }
  if (action === "queue") {
    return "Queue";
  }
  if (action === "execute") {
    return "Execution";
  }
  return "Cancellation";
}

function isActiveMandate(mandate: MandateDto): boolean {
  if (!mandate.active || mandate.revoked) {
    return false;
  }

  const now = BigInt(Math.floor(Date.now() / 1_000));
  const startTime = parseNumericBigInt(mandate.startTime);
  const endTime = parseNumericBigInt(mandate.endTime);

  if (startTime === undefined || endTime === undefined) {
    return false;
  }

  return startTime <= now && (endTime === 0n || endTime > now);
}

function mandateCoversProposalType(
  mandate: MandateDto,
  proposalType: ProposalDto["proposalType"],
): boolean {
  const mask = parseNumericBigInt(mandate.proposalTypeMask);
  const proposalTypeCode = getProposalTypeCode(proposalType);

  if (mask === undefined || proposalTypeCode === undefined) {
    return false;
  }

  return (mask & (1n << BigInt(proposalTypeCode))) !== 0n;
}

function getProposalTypeCode(
  proposalType: ProposalDto["proposalType"],
): number | undefined {
  for (const [code, value] of Object.entries(
    PROPOSAL_TYPE_CHAIN_MAP.valuesByCode,
  )) {
    if (value === proposalType) {
      return Number(code);
    }
  }

  return undefined;
}

function parseNumericBigInt(value: string): bigint | undefined {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function BodySelector({
  bodiesIndex,
  bodies,
  label,
  onChange,
  role,
  value,
}: {
  readonly bodiesIndex: readonly BodyDto[];
  readonly bodies: readonly (RouteBodyRequirementDto | RouteBodyVetoDto)[];
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly role: ProposalBodyActionRole;
  readonly value: string;
}): JSX.Element {
  if (bodies.length === 1) {
    return (
      <div className="proposal-action-body-fixed">
        <span>{label}</span>
        <strong>
          {getBodyActionLabel({
            bodies: bodiesIndex,
            bodyId: bodies[0].bodyId,
            bodyName: bodies[0].bodyName,
            role,
          })}
        </strong>
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
            {getBodyActionLabel({
              bodies: bodiesIndex,
              bodyId: body.bodyId,
              bodyName: body.bodyName,
              role,
            })}
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

function getActionReadiness({
  availableVetoBodies,
  bodies,
  demoExecutionReady,
  pendingApprovalBodies,
  proposal,
  route,
  routeError,
}: {
  readonly availableVetoBodies: readonly RouteBodyVetoDto[];
  readonly bodies: readonly BodyDto[];
  readonly demoExecutionReady: boolean;
  readonly pendingApprovalBodies: readonly RouteBodyRequirementDto[];
  readonly proposal: ProposalDto;
  readonly route?: ProposalRouteExplanationDto;
  readonly routeError?: Error;
}): readonly ActionReadinessItem[] {
  return [
    getApproveReadiness(proposal, route, routeError, pendingApprovalBodies, bodies),
    getVetoReadiness(proposal, route, routeError, availableVetoBodies, bodies),
    getQueueReadiness(proposal, route, routeError, bodies),
    getExecuteReadiness(proposal, route, routeError, demoExecutionReady, bodies),
    getCancelReadiness(proposal),
  ];
}

function getApproveReadiness(
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
  routeError: Error | undefined,
  pendingApprovalBodies: readonly RouteBodyRequirementDto[],
  bodies: readonly BodyDto[],
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
      detail: `Waiting on ${formatLabeledBodyList(
        pendingApprovalBodies,
        bodies,
        "Approver",
      )}.`,
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
  bodies: readonly BodyDto[],
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
      detail: `Veto-capable bodies: ${formatLabeledBodyList(
        availableVetoBodies,
        bodies,
        "Vetoer",
      )}.`,
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
  bodies: readonly BodyDto[],
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
      route,
      bodies,
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
  bodies: readonly BodyDto[],
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
      detail: "Route is executable and the configured action hash matches.",
    };
  }

  if (route.execution.executable && !demoExecutionReady) {
    return {
      label: "Execute",
      value: "Needs action input",
      tone: "warning",
      detail: "Route is executable, but the action input does not match.",
    };
  }

  return {
    label: "Execute",
    value: "Blocked",
    tone: "warning",
    detail: getBlockedReasonSummary(
      route,
      bodies,
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
  route: ProposalRouteExplanationDto,
  bodies: readonly BodyDto[],
  reasons: readonly RouteBlockedReasonDto[],
  fallback: string,
): string {
  const reason = reasons[0];
  return reason
    ? formatRouteBlockedReasonMessage({
        bodies,
        reason,
        role: reason.code === "missing_approval" ? "Approver" : undefined,
        route,
      })
    : fallback;
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
