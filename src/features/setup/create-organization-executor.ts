import type { CreateOrganizationSetupAction } from "@isonia/types";
import { isAddress } from "viem";
import {
  buildOrganizationSlug,
  GOV_CORE_ABI,
  parseOrganizationCreatedLog,
} from "../../chain/setup-contracts";
import { waitForIndexedOrganization } from "./indexing-waiters";
import { assertSuccessfulReceipt } from "./receipt-parsers";
import {
  isConfiguredAddress,
  isZeroAddress,
  normalizeTransactionError,
} from "./setup-action-execution-helpers";
import type {
  CreateOrganizationPayload,
  SetupActionExecutorContext,
  SetupActionTransaction,
} from "./setup-action-execution-types";

export async function executeCreateOrganizationAction({
  action,
  context,
}: {
  readonly action: CreateOrganizationSetupAction | undefined;
  readonly context: SetupActionExecutorContext;
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

  if (!action) {
    setState((current) => ({
      ...current,
      createOrganization: {
        stage: "failed",
        error: "No create organization setup action exists in this draft.",
      },
    }));
    return;
  }

  if (!setupWritesEnabled) {
    setActionFailed(action, "Organization setup writes are disabled by runtime config.");
    return;
  }

  if (!account.isConnected || !account.address) {
    setActionFailed(action, "Wallet is not connected.");
    return;
  }

  if (account.chainId !== runtimeConfig.chainId) {
    setActionFailed(
      action,
      `Wallet is connected to chain ${String(
        account.chainId,
      )}; expected chain ${runtimeConfig.chainId}.`,
    );
    return;
  }

  if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
    setActionFailed(
      action,
      "GovCore contract address is missing from runtime config.",
    );
    return;
  }

  if (!publicClient) {
    setActionFailed(
      action,
      "Wallet client is unavailable for the configured chain.",
    );
    return;
  }

  const payload = buildCreateOrganizationPayload(action);
  if (payload instanceof Error) {
    setActionFailed(action, payload.message);
    return;
  }

  try {
    setActionTransaction(action, {
      stage: "wallet_pending",
      slug: payload.slug,
    });
    const txHash = await writeContractAsync({
      address: runtimeConfig.contracts.govCoreAddress,
      abi: GOV_CORE_ABI,
      functionName: "createOrganization",
      args: [payload.slug, payload.metadataUri, payload.adminAddress],
      chainId: runtimeConfig.chainId,
    });

    setActionTransaction(action, {
      stage: "submitted",
      slug: payload.slug,
      txHash,
    });
    setActionTransaction(action, {
      stage: "confirming",
      slug: payload.slug,
      txHash,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    assertSuccessfulReceipt(receipt);
    const created = parseOrganizationCreatedLog(
      receipt,
      runtimeConfig.contracts.govCoreAddress,
    );
    if (!created) {
      throw new Error(
        "Transaction confirmed, but OrganizationCreated was not found in the receipt.",
      );
    }

    setActionTransaction(action, {
      orgId: created.orgId,
      stage: "confirmed_waiting_indexer",
      slug: created.slug,
      txHash,
    });
    const organization = await waitForIndexedOrganization({
      client,
      created,
      txHash,
    });

    setState((current) => ({
      ...current,
      createOrganization: {
        actionId: action.actionId,
        actionKind: action.kind,
        orgId: organization.orgId,
        slug: organization.slug,
        stage: "indexed",
        txHash,
      },
      resolvedOrgId: organization.orgId,
      resolvedOrganization: organization,
    }));
  } catch (error: unknown) {
    setActionTransaction(action, {
      stage: "failed",
      error: normalizeTransactionError(error),
      slug: payload.slug,
    });
  }

  function setActionFailed(
    failedAction: CreateOrganizationSetupAction,
    error: string,
  ): void {
    setActionTransaction(failedAction, { stage: "failed", error });
  }

  function setActionTransaction(
    nextAction: CreateOrganizationSetupAction,
    transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
  ): void {
    setState((current) => ({
      ...current,
      createOrganization: {
        actionId: nextAction.actionId,
        actionKind: nextAction.kind,
        ...transaction,
      },
    }));
  }
}

function buildCreateOrganizationPayload(
  action: CreateOrganizationSetupAction,
): CreateOrganizationPayload | Error {
  if (!isAddress(action.adminAddress) || isZeroAddress(action.adminAddress)) {
    return new Error("Organization admin address must be a non-zero EVM address.");
  }

  const slug = buildOrganizationSlug(action.fallbackName);
  if (!slug) {
    return new Error("Organization slug must not be empty.");
  }

  return {
    adminAddress: action.adminAddress,
    metadataUri: action.metadataUri ?? "",
    slug,
  };
}
