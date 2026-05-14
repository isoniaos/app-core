import type { CreateBodySetupAction } from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import {
  GOV_CORE_ABI,
  parseBodyCreatedLog,
} from "../../chain/setup-contracts";
import { waitForIndexedBody } from "./indexing-waiters";
import { assertSuccessfulReceipt } from "./receipt-parsers";
import {
  isConfiguredAddress,
  normalizeTransactionError,
} from "./setup-action-execution-helpers";
import { getSetupActionExecutionPreflight } from "./setup-action-preflight";
import type {
  SetupActionExecutorContext,
  SetupActionTransaction,
} from "./setup-action-execution-types";
import {
  buildCreateBodyCallArgs,
  buildCreateBodyPayload,
} from "./setup-prepared-calls";

export async function executeCreateBodyAction({
  actionId,
  actions,
  context,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly actionId: string;
  readonly actions: readonly CreateBodySetupAction[];
  readonly context: SetupActionExecutorContext;
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string | undefined;
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
      createBodies: {
        ...current.createBodies,
        [actionId]: {
          actionId,
          actionKind: SetupActionKind.CreateBody,
          error: "No create body setup action exists for this actionId.",
          stage: "failed",
        },
      },
    }));
    return;
  }

  if (resolvedBodyIds[action.actionId]) {
    return;
  }

  if (!setupWritesEnabled) {
    setBodyActionFailed(action, "Organization setup writes are disabled by runtime config.");
    return;
  }

  if (!resolvedOrgId) {
    setBodyActionFailed(
      action,
      "Create body is blocked until the organization is indexed and the real orgId is resolved.",
    );
    return;
  }

  const signerAddress = account.address;
  if (!account.isConnected || !signerAddress) {
    setBodyActionFailed(action, "Wallet is not connected.");
    return;
  }

  if (account.chainId !== runtimeConfig.chainId) {
    setBodyActionFailed(
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
    setBodyActionFailed(action, signerPreflight.message);
    return;
  }

  if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
    setBodyActionFailed(
      action,
      "GovCore contract address is missing from runtime config.",
    );
    return;
  }

  if (!publicClient) {
    setBodyActionFailed(
      action,
      "Wallet client is unavailable for the configured chain.",
    );
    return;
  }

  const payload = buildCreateBodyPayload(action, resolvedOrgId);
  if (payload instanceof Error) {
    setBodyActionFailed(action, payload.message);
    return;
  }

  try {
    setBodyActionTransaction(action, {
      orgId: payload.orgId,
      stage: "wallet_pending",
    });
    const txHash = await writeContractAsync({
      address: runtimeConfig.contracts.govCoreAddress,
      abi: GOV_CORE_ABI,
      functionName: "createBody",
      args: buildCreateBodyCallArgs(payload),
      chainId: runtimeConfig.chainId,
      account: signerAddress,
    });

    setBodyActionTransaction(action, {
      orgId: payload.orgId,
      stage: "submitted",
      txHash,
    });
    setBodyActionTransaction(action, {
      orgId: payload.orgId,
      stage: "confirming",
      txHash,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    assertSuccessfulReceipt(receipt);
    const created = parseBodyCreatedLog(
      receipt,
      runtimeConfig.contracts.govCoreAddress,
    );
    if (!created) {
      throw new Error(
        "Transaction confirmed, but BodyCreated was not found in the receipt.",
      );
    }

    if (created.orgId !== payload.orgId) {
      throw new Error(
        `Transaction emitted body for org #${created.orgId}, but setup expected org #${payload.orgId}.`,
      );
    }

    setBodyActionTransaction(action, {
      bodyId: created.bodyId,
      orgId: created.orgId,
      stage: "confirmed_waiting_indexer",
      txHash,
    });
    const body = await waitForIndexedBody({
      client,
      created,
      txHash,
    });

    setState((current) => ({
      ...current,
      createBodies: {
        ...current.createBodies,
        [action.actionId]: {
          actionId: action.actionId,
          actionKind: action.kind,
          bodyId: body.bodyId,
          orgId: body.orgId,
          stage: "indexed",
          txHash,
        },
      },
      resolvedBodies: {
        ...current.resolvedBodies,
        [action.actionId]: body,
      },
      resolvedBodyIds: {
        ...current.resolvedBodyIds,
        [action.actionId]: body.bodyId,
      },
    }));
  } catch (error: unknown) {
    setBodyActionTransaction(action, {
      error: normalizeTransactionError(error),
      orgId: payload.orgId,
      stage: "failed",
    });
  }

  function setBodyActionFailed(
    failedAction: CreateBodySetupAction,
    error: string,
  ): void {
    setBodyActionTransaction(failedAction, { stage: "failed", error });
  }

  function setBodyActionTransaction(
    nextAction: CreateBodySetupAction,
    transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
  ): void {
    setState((current) => ({
      ...current,
      createBodies: {
        ...current.createBodies,
        [nextAction.actionId]: {
          actionId: nextAction.actionId,
          actionKind: nextAction.kind,
          ...transaction,
        },
      },
    }));
  }
}
