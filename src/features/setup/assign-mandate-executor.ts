import type {
  AssignMandateSetupAction,
  CreateRoleSetupAction,
  RoleDto,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import {
  GOV_CORE_ABI,
  parseMandateAssignedLog,
} from "../../chain/setup-contracts";
import { waitForIndexedMandate } from "./indexing-waiters";
import {
  assertMandateMatchesPayload,
  assertSuccessfulReceipt,
} from "./receipt-parsers";
import {
  getProposalTypeMask,
  isConfiguredAddress,
  isZeroAddress,
  normalizeTransactionError,
  parsePositiveUint64,
  parseUint128,
  parseUint256,
  parseUint64,
  resolveRoleReadModel,
  resolveRoleReference,
} from "./setup-action-execution-helpers";
import type {
  AssignMandatePayload,
  SetupActionExecutorContext,
  SetupActionTransaction,
} from "./setup-action-execution-types";
import { isAddress } from "viem";

export async function executeAssignMandateAction({
  actionId,
  actions,
  busy,
  context,
  resolvedMandateIds,
  resolvedOrgId,
  resolvedRoleIds,
  resolvedRoles,
  roleActions,
}: {
  readonly actionId: string;
  readonly actions: readonly AssignMandateSetupAction[];
  readonly busy: boolean;
  readonly context: SetupActionExecutorContext;
  readonly resolvedMandateIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string | undefined;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly resolvedRoles: Readonly<Record<string, RoleDto>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): Promise<void> {
  const {
    account,
    client,
    publicClient,
    runtimeConfig,
    setState,
    setupWritesEnabled,
    writeContractAsync,
  } = context;
  const action = actions.find((candidate) => candidate.actionId === actionId);
  if (!action) {
    setState((current) => ({
      ...current,
      assignMandates: {
        ...current.assignMandates,
        [actionId]: {
          actionId,
          actionKind: SetupActionKind.AssignMandate,
          error: "No assign mandate setup action exists for this actionId.",
          stage: "failed",
        },
      },
    }));
    return;
  }

  if (resolvedMandateIds[action.actionId]) {
    return;
  }

  if (busy) {
    setMandateActionFailed(action, "Another setup transaction is active.");
    return;
  }

  if (!setupWritesEnabled) {
    setMandateActionFailed(
      action,
      "Organization setup writes are disabled by runtime config.",
    );
    return;
  }

  if (!resolvedOrgId) {
    setMandateActionFailed(
      action,
      "Assign mandate is blocked until the organization is indexed and the real orgId is resolved.",
    );
    return;
  }

  const resolvedRoleId = resolveRoleReference({
    reference: action.roleRef,
    resolvedRoleIds,
    roleActions,
  });
  if (!resolvedRoleId) {
    setMandateActionFailed(
      action,
      "Assign mandate is blocked until the referenced role is indexed and the real roleId is resolved.",
    );
    return;
  }

  if (!account.isConnected || !account.address) {
    setMandateActionFailed(action, "Wallet is not connected.");
    return;
  }

  if (account.chainId !== runtimeConfig.chainId) {
    setMandateActionFailed(
      action,
      `Wallet is connected to chain ${String(
        account.chainId,
      )}; expected chain ${runtimeConfig.chainId}.`,
    );
    return;
  }

  if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
    setMandateActionFailed(
      action,
      "GovCore contract address is missing from runtime config.",
    );
    return;
  }

  if (!publicClient) {
    setMandateActionFailed(
      action,
      "Wallet client is unavailable for the configured chain.",
    );
    return;
  }

  const payload = buildAssignMandatePayload(
    action,
    resolvedOrgId,
    resolvedRoleId,
  );
  if (payload instanceof Error) {
    setMandateActionFailed(action, payload.message);
    return;
  }

  try {
    setMandateActionTransaction(action, {
      holderAddress: payload.holderAddress,
      orgId: payload.orgId,
      roleId: payload.roleId,
      stage: "wallet_pending",
    });
    const txHash = await writeContractAsync({
      address: runtimeConfig.contracts.govCoreAddress,
      abi: GOV_CORE_ABI,
      functionName: "assignMandate",
      args: [
        payload.orgIdBigInt,
        payload.roleIdBigInt,
        payload.holderAddress,
        payload.startTimeBigInt,
        payload.endTimeBigInt,
        payload.proposalTypeMaskBigInt,
        payload.spendingLimitBigInt,
      ],
      chainId: runtimeConfig.chainId,
    });

    setMandateActionTransaction(action, {
      holderAddress: payload.holderAddress,
      orgId: payload.orgId,
      roleId: payload.roleId,
      stage: "submitted",
      txHash,
    });
    setMandateActionTransaction(action, {
      holderAddress: payload.holderAddress,
      orgId: payload.orgId,
      roleId: payload.roleId,
      stage: "confirming",
      txHash,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    assertSuccessfulReceipt(receipt);
    const assigned = parseMandateAssignedLog(
      receipt,
      runtimeConfig.contracts.govCoreAddress,
    );
    if (!assigned) {
      throw new Error(
        "Transaction confirmed, but MandateAssigned was not found in the receipt.",
      );
    }

    assertMandateMatchesPayload(assigned, payload);

    const resolvedRole = resolveRoleReadModel({
      reference: action.roleRef,
      resolvedRoles,
      roleActions,
    });
    if (resolvedRole && assigned.bodyId !== resolvedRole.bodyId) {
      throw new Error(
        `Transaction emitted mandate for body #${assigned.bodyId}, but setup expected body #${resolvedRole.bodyId}.`,
      );
    }

    setMandateActionTransaction(action, {
      bodyId: assigned.bodyId,
      holderAddress: assigned.holderAddress,
      mandateId: assigned.mandateId,
      orgId: assigned.orgId,
      roleId: assigned.roleId,
      stage: "confirmed_waiting_indexer",
      txHash,
    });
    const mandate = await waitForIndexedMandate({
      assigned,
      client,
      payload,
      txHash,
    });

    setState((current) => ({
      ...current,
      assignMandates: {
        ...current.assignMandates,
        [action.actionId]: {
          actionId: action.actionId,
          actionKind: action.kind,
          bodyId: mandate.bodyId,
          holderAddress: mandate.holderAddress,
          mandateId: mandate.mandateId,
          orgId: mandate.orgId,
          roleId: mandate.roleId,
          stage: "indexed",
          txHash,
        },
      },
      resolvedMandateIds: {
        ...current.resolvedMandateIds,
        [action.actionId]: mandate.mandateId,
      },
      resolvedMandates: {
        ...current.resolvedMandates,
        [action.actionId]: mandate,
      },
    }));
  } catch (error: unknown) {
    setMandateActionTransaction(action, {
      error: normalizeTransactionError(error),
      holderAddress: payload.holderAddress,
      orgId: payload.orgId,
      roleId: payload.roleId,
      stage: "failed",
    });
  }

  function setMandateActionFailed(
    failedAction: AssignMandateSetupAction,
    error: string,
  ): void {
    setMandateActionTransaction(failedAction, { stage: "failed", error });
  }

  function setMandateActionTransaction(
    nextAction: AssignMandateSetupAction,
    transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
  ): void {
    setState((current) => ({
      ...current,
      assignMandates: {
        ...current.assignMandates,
        [nextAction.actionId]: {
          actionId: nextAction.actionId,
          actionKind: nextAction.kind,
          ...transaction,
        },
      },
    }));
  }
}

function buildAssignMandatePayload(
  action: AssignMandateSetupAction,
  resolvedOrgId: string,
  resolvedRoleId: string,
): AssignMandatePayload | Error {
  if (!isAddress(action.holderAddress) || isZeroAddress(action.holderAddress)) {
    return new Error("Mandate holder address must be a non-zero EVM address.");
  }

  const orgIdBigInt = parsePositiveUint64(resolvedOrgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const roleIdBigInt = parsePositiveUint64(resolvedRoleId, "Resolved roleId");
  if (roleIdBigInt instanceof Error) {
    return roleIdBigInt;
  }

  const startTimeBigInt = parseUint64(action.startTime, "Mandate start time");
  if (startTimeBigInt instanceof Error) {
    return startTimeBigInt;
  }

  const endTimeBigInt = parseUint64(action.endTime, "Mandate end time");
  if (endTimeBigInt instanceof Error) {
    return endTimeBigInt;
  }

  if (endTimeBigInt !== 0n && endTimeBigInt <= startTimeBigInt) {
    return new Error(
      "Mandate end time must be zero or greater than the start time.",
    );
  }

  const proposalTypeMaskBigInt = parseUint256(
    action.proposalTypeMask,
    "Mandate proposal type mask",
  );
  if (proposalTypeMaskBigInt instanceof Error) {
    return proposalTypeMaskBigInt;
  }

  if (proposalTypeMaskBigInt === 0n) {
    return new Error("Mandate proposal type mask must cover at least one proposal type.");
  }

  if (action.proposalTypes) {
    const expectedMask = getProposalTypeMask(action.proposalTypes);
    if (proposalTypeMaskBigInt !== expectedMask) {
      return new Error(
        `Mandate proposal type mask ${proposalTypeMaskBigInt.toString()} does not match the selected proposal type scope ${expectedMask.toString()}.`,
      );
    }
  }

  const spendingLimitBigInt = parseUint128(
    action.spendingLimit,
    "Mandate spending limit",
  );
  if (spendingLimitBigInt instanceof Error) {
    return spendingLimitBigInt;
  }

  return {
    endTime: endTimeBigInt.toString(),
    endTimeBigInt,
    holderAddress: action.holderAddress,
    orgId: resolvedOrgId,
    orgIdBigInt,
    proposalTypeMask: proposalTypeMaskBigInt.toString(),
    proposalTypeMaskBigInt,
    roleId: resolvedRoleId,
    roleIdBigInt,
    spendingLimit: spendingLimitBigInt.toString(),
    spendingLimitBigInt,
    startTime: startTimeBigInt.toString(),
    startTimeBigInt,
  };
}
