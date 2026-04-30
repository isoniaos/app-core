import { useCallback, useMemo, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type {
  Address,
  CreateOrganizationSetupAction,
  OrganizationDto,
  SetupAction,
  SetupDraft,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import type { TransactionReceipt } from "viem";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import {
  buildOrganizationSlug,
  GOV_CORE_ABI,
  parseOrganizationCreatedLog,
  type OrganizationCreatedLog,
} from "../../chain/setup-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";

export type SetupActionLifecycleStage =
  | "idle"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "indexed"
  | "failed";

export interface SetupActionTransaction {
  readonly actionId?: string;
  readonly actionKind?: SetupActionKind;
  readonly error?: string;
  readonly orgId?: string;
  readonly slug?: string;
  readonly stage: SetupActionLifecycleStage;
  readonly txHash?: `0x${string}`;
}

export interface SetupDraftExecutionState {
  readonly createOrganization: SetupActionTransaction;
  readonly resolvedOrganization?: OrganizationDto;
  readonly resolvedOrgId?: string;
}

export interface SetupActionReadiness {
  readonly message: string;
  readonly title: string;
}

interface UseSetupActionExecutionOptions {
  readonly draft: SetupDraft;
}

const INDEXER_POLL_INTERVAL_MS = 1_500;
const INDEXER_TIMEOUT_MS = 60_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useSetupActionExecution({
  draft,
}: UseSetupActionExecutionOptions): {
  readonly busy: boolean;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly readiness: SetupActionReadiness | undefined;
  readonly reset: () => void;
  readonly state: SetupDraftExecutionState;
} {
  const runtimeConfig = useRuntimeConfig();
  const client = useIsoniaClient();
  const account = useAccount();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<SetupDraftExecutionState>({
    createOrganization: { stage: "idle" },
  });

  const createOrganizationAction = useMemo(
    () => getCreateOrganizationAction(draft.actions),
    [draft.actions],
  );
  const setupWritesEnabled =
    runtimeConfig.features.writeActions && runtimeConfig.features.manageOrg;
  const readiness = useMemo(
    () =>
      getReadiness({
        accountChainId: account.chainId,
        action: createOrganizationAction,
        connected: account.isConnected,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        publicClientReady: Boolean(publicClient),
        runtimeChainId: runtimeConfig.chainId,
        setupWritesEnabled,
        transaction: state.createOrganization,
      }),
    [
      account.chainId,
      account.isConnected,
      createOrganizationAction,
      publicClient,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      state.createOrganization,
    ],
  );

  const busy =
    state.createOrganization.stage === "wallet_pending" ||
    state.createOrganization.stage === "submitted" ||
    state.createOrganization.stage === "confirming" ||
    state.createOrganization.stage === "confirmed_waiting_indexer";

  const reset = useCallback(() => {
    setState({
      createOrganization: { stage: "idle" },
    });
  }, []);

  const executeCreateOrganization = useCallback(async (): Promise<void> => {
    const action = createOrganizationAction;
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

      setState({
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
      });
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
  }, [
    account.address,
    account.chainId,
    account.isConnected,
    client,
    createOrganizationAction,
    publicClient,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
    setupWritesEnabled,
    writeContractAsync,
  ]);

  return {
    busy,
    executeCreateOrganization,
    readiness,
    reset,
    state,
  };
}

interface CreateOrganizationPayload {
  readonly adminAddress: Address;
  readonly metadataUri: string;
  readonly slug: string;
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

async function waitForIndexedOrganization({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: OrganizationCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<OrganizationDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const organizations = await client.getOrganizations();
      const byTxHash = organizations.find((organization) =>
        sameHex(organization.createdTxHash, txHash),
      );
      if (byTxHash) {
        return byTxHash;
      }

      const byCreatedId = organizations.find(
        (organization) =>
          organization.orgId === created.orgId &&
          sameAddress(organization.adminAddress, created.adminAddress) &&
          organization.slug === created.slug,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: organization from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

function getReadiness({
  accountChainId,
  action,
  connected,
  govCoreAddress,
  publicClientReady,
  runtimeChainId,
  setupWritesEnabled,
  transaction,
}: {
  readonly accountChainId: number | undefined;
  readonly action: CreateOrganizationSetupAction | undefined;
  readonly connected: boolean;
  readonly govCoreAddress: Address;
  readonly publicClientReady: boolean;
  readonly runtimeChainId: number;
  readonly setupWritesEnabled: boolean;
  readonly transaction: SetupActionTransaction;
}): SetupActionReadiness | undefined {
  if (transaction.stage === "indexed") {
    return {
      title: "Organization indexed",
      message: "The real orgId has been resolved from Control Plane read models.",
    };
  }

  if (!action) {
    return {
      title: "No create organization action",
      message: "This draft is already attached to an indexed organization.",
    };
  }

  if (!setupWritesEnabled) {
    return {
      title: "Setup writes disabled",
      message: "Enable features.writeActions and features.manageOrg in runtime config.",
    };
  }

  if (!isConfiguredAddress(govCoreAddress)) {
    return {
      title: "Protocol config missing",
      message: "Set contracts.govCoreAddress in runtime config.",
    };
  }

  if (action.warnings.some((warning) => warning.severity === "error")) {
    return {
      title: "Create organization blocked",
      message: "Resolve the create organization validation errors before submitting.",
    };
  }

  if (!connected) {
    return {
      title: "Wallet not connected",
      message: "Connect a wallet before submitting the setup action.",
    };
  }

  if (accountChainId !== runtimeChainId) {
    return {
      title: "Wrong chain",
      message: `Connected chain ${String(
        accountChainId,
      )}; expected chain ${runtimeChainId}.`,
    };
  }

  if (!publicClientReady) {
    return {
      title: "Protocol client unavailable",
      message: "The configured chain client is not ready.",
    };
  }

  return undefined;
}

function getCreateOrganizationAction(
  actions: readonly SetupAction[],
): CreateOrganizationSetupAction | undefined {
  return actions.find(
    (action): action is CreateOrganizationSetupAction =>
      action.kind === SetupActionKind.CreateOrganization,
  );
}

function assertSuccessfulReceipt(receipt: TransactionReceipt): void {
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

function isConfiguredAddress(value: Address): boolean {
  return isAddress(value) && !isZeroAddress(value);
}

function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === ZERO_ADDRESS;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeTransactionError(error: unknown): string {
  const message = getErrorMessage(error);

  if (/user rejected|rejected request|denied transaction/i.test(message)) {
    return "Wallet transaction was rejected.";
  }

  if (/reverted|execution reverted|contract function execution/i.test(message)) {
    return `Transaction reverted: ${message}`;
  }

  if (/timeout|timed out/i.test(message)) {
    return message;
  }

  return message;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.shortMessage === "string") {
      return record.shortMessage;
    }
    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return "Unknown transaction error.";
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}
