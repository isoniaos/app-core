import type {
  CreateBodySetupAction,
  CreateRoleSetupAction,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import {
  GOV_CORE_ABI,
  parseRoleCreatedLog,
} from "../../chain/setup-contracts";
import { waitForIndexedRole } from "./indexing-waiters";
import { assertSuccessfulReceipt } from "./receipt-parsers";
import {
  isConfiguredAddress,
  normalizeTransactionError,
  resolveBodyReference,
} from "./setup-action-execution-helpers";
import { getSetupActionExecutionPreflight } from "./setup-action-preflight";
import type {
  SetupActionExecutorContext,
  SetupActionTransaction,
} from "./setup-action-execution-types";
import {
  buildCreateRoleCallArgs,
  buildCreateRolePayload,
} from "./setup-prepared-calls";

export async function executeCreateRoleAction({
  actionId,
  actions,
  bodyActions,
  busy,
  context,
  resolvedBodyIds,
  resolvedOrgId,
  resolvedRoleIds,
}: {
  readonly actionId: string;
  readonly actions: readonly CreateRoleSetupAction[];
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly busy: boolean;
  readonly context: SetupActionExecutorContext;
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string | undefined;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
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
      createRoles: {
        ...current.createRoles,
        [actionId]: {
          actionId,
          actionKind: SetupActionKind.CreateRole,
          error: "No create role setup action exists for this actionId.",
          stage: "failed",
        },
      },
    }));
    return;
  }

  if (resolvedRoleIds[action.actionId]) {
    return;
  }

  if (busy) {
    setRoleActionFailed(action, "Another setup transaction is active.");
    return;
  }

  if (!setupWritesEnabled) {
    setRoleActionFailed(action, "Organization setup writes are disabled by runtime config.");
    return;
  }

  if (!resolvedOrgId) {
    setRoleActionFailed(
      action,
      "Create role is blocked until the organization is indexed and the real orgId is resolved.",
    );
    return;
  }

  const resolvedBodyId = resolveBodyReference({
    bodyActions,
    reference: action.bodyRef,
    resolvedBodyIds,
  });
  if (!resolvedBodyId) {
    setRoleActionFailed(
      action,
      "Create role is blocked until the referenced body is indexed and the real bodyId is resolved.",
    );
    return;
  }

  const signerAddress = account.address;
  if (!account.isConnected || !signerAddress) {
    setRoleActionFailed(action, "Wallet is not connected.");
    return;
  }

  if (account.chainId !== runtimeConfig.chainId) {
    setRoleActionFailed(
      action,
      `Wallet is connected to chain ${String(
        account.chainId,
      )}; expected chain ${runtimeConfig.chainId}.`,
    );
    return;
  }

  const signerPreflight = getSetupActionExecutionPreflight(action, {
    accountChainId: account.chainId,
    connected: account.isConnected,
    connectedAddress: account.address,
    govCoreAddress: runtimeConfig.contracts.govCoreAddress,
    runtimeChainId: runtimeConfig.chainId,
    setupWritesEnabled,
  });
  if (!signerPreflight.canExecute) {
    setRoleActionFailed(action, signerPreflight.message);
    return;
  }

  if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
    setRoleActionFailed(
      action,
      "GovCore contract address is missing from runtime config.",
    );
    return;
  }

  if (!publicClient) {
    setRoleActionFailed(
      action,
      "Wallet client is unavailable for the configured chain.",
    );
    return;
  }

  const payload = buildCreateRolePayload(action, resolvedOrgId, resolvedBodyId);
  if (payload instanceof Error) {
    setRoleActionFailed(action, payload.message);
    return;
  }

  try {
    setRoleActionTransaction(action, {
      bodyId: payload.bodyId,
      orgId: payload.orgId,
      stage: "wallet_pending",
    });
    const txHash = await writeContractAsync({
      address: runtimeConfig.contracts.govCoreAddress,
      abi: GOV_CORE_ABI,
      functionName: "createRole",
      args: buildCreateRoleCallArgs(payload),
      chainId: runtimeConfig.chainId,
      account: signerAddress,
    });

    setRoleActionTransaction(action, {
      bodyId: payload.bodyId,
      orgId: payload.orgId,
      stage: "submitted",
      txHash,
    });
    setRoleActionTransaction(action, {
      bodyId: payload.bodyId,
      orgId: payload.orgId,
      stage: "confirming",
      txHash,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    assertSuccessfulReceipt(receipt);
    const created = parseRoleCreatedLog(
      receipt,
      runtimeConfig.contracts.govCoreAddress,
    );
    if (!created) {
      throw new Error(
        "Transaction confirmed, but RoleCreated was not found in the receipt.",
      );
    }

    if (created.orgId !== payload.orgId) {
      throw new Error(
        `Transaction emitted role for org #${created.orgId}, but setup expected org #${payload.orgId}.`,
      );
    }

    if (created.bodyId !== payload.bodyId) {
      throw new Error(
        `Transaction emitted role for body #${created.bodyId}, but setup expected body #${payload.bodyId}.`,
      );
    }

    if (created.roleType !== action.roleType) {
      throw new Error(
        `Transaction emitted ${created.roleType}, but setup expected ${action.roleType}.`,
      );
    }

    setRoleActionTransaction(action, {
      bodyId: created.bodyId,
      orgId: created.orgId,
      roleId: created.roleId,
      stage: "confirmed_waiting_indexer",
      txHash,
    });
    const role = await waitForIndexedRole({
      client,
      created,
      txHash,
    });

    setState((current) => ({
      ...current,
      createRoles: {
        ...current.createRoles,
        [action.actionId]: {
          actionId: action.actionId,
          actionKind: action.kind,
          bodyId: role.bodyId,
          orgId: role.orgId,
          roleId: role.roleId,
          stage: "indexed",
          txHash,
        },
      },
      resolvedRoleIds: {
        ...current.resolvedRoleIds,
        [action.actionId]: role.roleId,
      },
      resolvedRoles: {
        ...current.resolvedRoles,
        [action.actionId]: role,
      },
    }));
  } catch (error: unknown) {
    setRoleActionTransaction(action, {
      bodyId: payload.bodyId,
      error: normalizeTransactionError(error),
      orgId: payload.orgId,
      stage: "failed",
    });
  }

  function setRoleActionFailed(
    failedAction: CreateRoleSetupAction,
    error: string,
  ): void {
    setRoleActionTransaction(failedAction, { stage: "failed", error });
  }

  function setRoleActionTransaction(
    nextAction: CreateRoleSetupAction,
    transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
  ): void {
    setState((current) => ({
      ...current,
      createRoles: {
        ...current.createRoles,
        [nextAction.actionId]: {
          actionId: nextAction.actionId,
          actionKind: nextAction.kind,
          ...transaction,
        },
      },
    }));
  }
}
