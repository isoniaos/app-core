import type { CreateOrganizationSetupAction } from "@isonia/types";
import { isAddress } from "viem";
import {
  buildOrganizationSlug,
  validateOrganizationSlug,
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

  const signerAddress = account.address;
  if (!account.isConnected || !signerAddress) {
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

  const slugConflict = await hasIndexedSlugConflict({
    currentOrgId: action.orgId,
    slug: payload.slug,
  });
  if (slugConflict) {
    setActionFailed(
      action,
      `Organization slug "${payload.slug}" already appears in the Control Plane read model.`,
    );
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
      account: signerAddress,
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

  async function hasIndexedSlugConflict({
    currentOrgId,
    slug,
  }: {
    readonly currentOrgId?: string;
    readonly slug: string;
  }): Promise<boolean> {
    try {
      const organizations = await client.getOrganizations();
      return organizations.some(
        (organization) =>
          organization.slug === slug && organization.orgId !== currentOrgId,
      );
    } catch {
      return false;
    }
  }
}

function buildCreateOrganizationPayload(
  action: CreateOrganizationSetupAction,
): CreateOrganizationPayload | Error {
  if (!isAddress(action.adminAddress) || isZeroAddress(action.adminAddress)) {
    return new Error("Organization admin address must be a non-zero EVM address.");
  }

  const slug = getCreateOrganizationActionSlug(action);
  const slugError = validateOrganizationSlug(slug);
  if (slugError) {
    return new Error(slugError);
  }

  return {
    adminAddress: action.adminAddress,
    metadataUri: action.metadataUri ?? "",
    slug,
  };
}

function getCreateOrganizationActionSlug(
  action: CreateOrganizationSetupAction,
): string {
  const explicitSlug = (action as CreateOrganizationSetupAction & {
    readonly slug?: string;
  }).slug?.trim();

  return explicitSlug || buildOrganizationSlug(action.fallbackName);
}
