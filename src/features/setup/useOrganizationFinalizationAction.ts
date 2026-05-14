import { useCallback, useMemo, useRef, useState } from "react";
import {
  createOrganizationFinalizationPlan,
  isOrganizationFinalizedStatus,
} from "@isonia/sdk";
import type {
  Address,
  OrganizationFinalizationReadModelDto,
} from "@isonia/types";
import {
  ORGANIZATION_FINALIZATION_STATUSES,
  OrganizationStatus,
} from "@isonia/types";
import { usePublicClient, useWriteContract } from "wagmi";
import { loadOrganizationFinalization } from "../../api/organization-finalization";
import { GOV_CORE_ABI } from "../../chain/setup-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";
import {
  useTransactionModal,
  type TransactionFlowStage,
} from "../../transactions";
import { useWalletConnection } from "../../wallet/useWalletConnection";
import { assertSuccessfulReceipt } from "./receipt-parsers";
import {
  delay,
  isConfiguredAddress,
  normalizeTransactionError,
  sameAddress,
} from "./setup-action-execution-helpers";

export type OrganizationFinalizationActionStage =
  | "idle"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "indexed"
  | "failed";

export interface OrganizationFinalizationActionReadiness {
  readonly buttonLabel: string;
  readonly message: string;
  readonly title: string;
}

export interface OrganizationFinalizationTransaction {
  readonly error?: string;
  readonly stage: OrganizationFinalizationActionStage;
  readonly txHash?: `0x${string}`;
}

export interface OrganizationFinalizationAction {
  readonly busy: boolean;
  readonly readiness: OrganizationFinalizationActionReadiness | undefined;
  readonly reset: () => void;
  readonly run: () => Promise<void>;
  readonly transaction: OrganizationFinalizationTransaction;
}

interface UseOrganizationFinalizationActionOptions {
  readonly adminAddress?: Address;
  readonly finalization?: OrganizationFinalizationReadModelDto;
  readonly finalizationError?: Error;
  readonly finalizationLoading: boolean;
  readonly onIndexed?: (data: OrganizationFinalizationReadModelDto) => void;
  readonly orgId: string;
}

const FINALIZATION_INDEXER_POLL_INTERVAL_MS = 1_500;
const FINALIZATION_INDEXER_TIMEOUT_MS = 60_000;

export function useOrganizationFinalizationAction({
  adminAddress,
  finalization,
  finalizationError,
  finalizationLoading,
  onIndexed,
  orgId,
}: UseOrganizationFinalizationActionOptions): OrganizationFinalizationAction {
  const runtimeConfig = useRuntimeConfig();
  const wallet = useWalletConnection();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const {
    openSingle: openTransactionModal,
    reset: resetTransactionModal,
    updateItem: updateTransactionModalItem,
  } = useTransactionModal();
  const [transaction, setTransaction] =
    useState<OrganizationFinalizationTransaction>({ stage: "idle" });
  const activeItemId = useRef<string | undefined>(undefined);
  const executeRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const plan = useMemo(
    () => createOrganizationFinalizationPlan({ orgId }),
    [orgId],
  );
  const setupWritesEnabled =
    runtimeConfig.features.writeActions && runtimeConfig.features.manageOrg;
  const readiness = useMemo(
    () =>
      getOrganizationFinalizationReadiness({
        accountChainId: wallet.chainId,
        adminAddress,
        connected: wallet.isConnected,
        connectedAddress: wallet.address,
        finalization,
        finalizationError,
        finalizationLoading,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        publicClientReady: Boolean(publicClient),
        runtimeChainId: runtimeConfig.chainId,
        setupWritesEnabled,
      }),
    [
      adminAddress,
      finalization,
      finalizationError,
      finalizationLoading,
      publicClient,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      wallet.address,
      wallet.chainId,
      wallet.isConnected,
    ],
  );
  const busy =
    transaction.stage === "wallet_pending" ||
    transaction.stage === "submitted" ||
    transaction.stage === "confirming" ||
    transaction.stage === "confirmed_waiting_indexer";

  const reset = useCallback(() => {
    activeItemId.current = undefined;
    setTransaction({ stage: "idle" });
    resetTransactionModal();
  }, [resetTransactionModal]);

  const execute = useCallback(async (): Promise<void> => {
    const itemId = activeItemId.current ?? buildFinalizationModalItemId(orgId);
    const setFinalizationTransaction = (
      next: OrganizationFinalizationTransaction,
      patch: {
        readonly retry?: () => Promise<void> | void;
        readonly retryLabel?: string;
      } = {},
    ): void => {
      setTransaction(next);
      updateTransactionModalItem(itemId, {
        blockExplorerUrl: runtimeConfig.blockExplorerUrl,
        error: next.error,
        retry: undefined,
        retryLabel: undefined,
        stage: mapFinalizationStageToTransactionFlowStage(next.stage),
        txHash: next.txHash,
        ...patch,
      });
    };
    const fail = (message: string, txHash?: `0x${string}`): void => {
      setFinalizationTransaction(
        {
          error: message,
          stage: "failed",
          txHash,
        },
        {
          retry: () => executeRef.current?.(),
          retryLabel: "Retry finalization",
        },
      );
    };

    if (readiness) {
      fail(readiness.message);
      return;
    }

    const signerAddress = wallet.address;
    if (!signerAddress) {
      fail("Wallet is not connected.");
      return;
    }

    if (!publicClient) {
      fail("Wallet client is unavailable for the configured chain.");
      return;
    }

    const parsedOrgId = parseOrganizationId(orgId);
    if (parsedOrgId instanceof Error) {
      fail(parsedOrgId.message);
      return;
    }

    let txHash: `0x${string}` | undefined;
    try {
      setFinalizationTransaction({ stage: "wallet_pending" });
      txHash = await writeContractAsync({
        address: runtimeConfig.contracts.govCoreAddress,
        abi: GOV_CORE_ABI,
        functionName: plan.functionName,
        args: [parsedOrgId],
        chainId: runtimeConfig.chainId,
        account: signerAddress,
      });

      setFinalizationTransaction({ stage: "submitted", txHash });
      setFinalizationTransaction({ stage: "confirming", txHash });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      assertSuccessfulReceipt(receipt);

      setFinalizationTransaction({
        stage: "confirmed_waiting_indexer",
        txHash,
      });
      const indexed = await waitForFinalizationIndexed({
        apiBaseUrl: runtimeConfig.apiBaseUrl,
        orgId,
      });

      setFinalizationTransaction({ stage: "indexed", txHash });
      onIndexed?.(indexed);
    } catch (error: unknown) {
      fail(normalizeTransactionError(error), txHash);
    }
  }, [
    onIndexed,
    orgId,
    plan.functionName,
    publicClient,
    readiness,
    runtimeConfig.apiBaseUrl,
    runtimeConfig.blockExplorerUrl,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
    updateTransactionModalItem,
    wallet.address,
    writeContractAsync,
  ]);

  executeRef.current = execute;

  const run = useCallback(async (): Promise<void> => {
    const itemId = buildFinalizationModalItemId(orgId);
    activeItemId.current = itemId;
    setTransaction({ stage: "idle" });
    openTransactionModal({
      description:
        "Finalize the organization through GovCore, then wait for Control Plane to index finalization metadata.",
      item: {
        blockExplorerUrl: runtimeConfig.blockExplorerUrl,
        description: `${plan.functionName}(${plan.orgId}) is irreversible in this alpha and blocks bootstrap-admin mutations.`,
        execute: () => executeRef.current?.(),
        executeLabel: "Finalize organization",
        id: itemId,
        stage: "idle",
        title: plan.label,
      },
      title: "Finalize organization",
    });
  }, [openTransactionModal, orgId, plan, runtimeConfig.blockExplorerUrl]);

  return {
    busy,
    readiness,
    reset,
    run,
    transaction,
  };
}

function getOrganizationFinalizationReadiness({
  accountChainId,
  adminAddress,
  connected,
  connectedAddress,
  finalization,
  finalizationError,
  finalizationLoading,
  govCoreAddress,
  publicClientReady,
  runtimeChainId,
  setupWritesEnabled,
}: {
  readonly accountChainId?: number;
  readonly adminAddress?: Address;
  readonly connected: boolean;
  readonly connectedAddress?: Address;
  readonly finalization?: OrganizationFinalizationReadModelDto;
  readonly finalizationError?: Error;
  readonly finalizationLoading: boolean;
  readonly govCoreAddress: Address;
  readonly publicClientReady: boolean;
  readonly runtimeChainId: number;
  readonly setupWritesEnabled: boolean;
}): OrganizationFinalizationActionReadiness | undefined {
  if (finalization?.finalized === true) {
    return {
      buttonLabel: "Already finalized",
      message: "This organization is already finalized.",
      title: "Already finalized",
    };
  }

  if (finalizationLoading && !finalization) {
    return {
      buttonLabel: "Checking status",
      message: "Checking finalization status before enabling finalization.",
      title: "Checking finalization status",
    };
  }

  if (finalizationError) {
    return {
      buttonLabel: "Status unavailable",
      message:
        "Control Plane finalization status is unavailable, so App Core will not submit finalization.",
      title: "Finalization status unavailable",
    };
  }

  if (!finalization) {
    return {
      buttonLabel: "Status unavailable",
      message: "Finalization metadata is not available for this organization.",
      title: "Finalization status unavailable",
    };
  }

  if (
    finalization.finalizationStatus ===
      ORGANIZATION_FINALIZATION_STATUSES.Unsupported ||
    !finalization.derived.finalizationSupported
  ) {
    return {
      buttonLabel: "Unsupported",
      message:
        "Control Plane does not report finalization support for this protocol deployment.",
      title: "Finalization unsupported",
    };
  }

  if (
    finalization.organizationStatus !== OrganizationStatus.Active ||
    !finalization.derived.activeNotFinalized
  ) {
    return {
      buttonLabel: "Activation incomplete",
      message:
        "Finalization is available only after the organization is active and not finalized.",
      title: "Activation incomplete",
    };
  }

  if (!setupWritesEnabled) {
    return {
      buttonLabel: "Writes disabled",
      message:
        "Enable write actions and organization management in runtime config.",
      title: "Setup writes disabled",
    };
  }

  if (!isConfiguredAddress(govCoreAddress)) {
    return {
      buttonLabel: "Protocol config missing",
      message: "Set contracts.govCoreAddress in runtime config.",
      title: "Protocol config missing",
    };
  }

  if (!adminAddress) {
    return {
      buttonLabel: "Admin unavailable",
      message:
        "The indexed bootstrap admin address is unavailable, so App Core cannot confirm authority.",
      title: "Bootstrap admin unavailable",
    };
  }

  if (!connected || !connectedAddress) {
    return {
      buttonLabel: "Connect wallet",
      message:
        "Connect the indexed bootstrap admin wallet before finalizing this organization.",
      title: "Wallet not connected",
    };
  }

  if (accountChainId !== runtimeChainId) {
    return {
      buttonLabel: "Switch chain",
      message: `Connected chain ${String(
        accountChainId,
      )}; expected chain ${runtimeChainId}.`,
      title: "Wrong chain",
    };
  }

  if (!sameAddress(connectedAddress, adminAddress)) {
    return {
      buttonLabel: "Switch wallet",
      message:
        "Connected wallet does not match the indexed bootstrap admin address.",
      title: "Connected wallet is not bootstrap admin",
    };
  }

  if (!publicClientReady) {
    return {
      buttonLabel: "Protocol client unavailable",
      message: "The configured chain client is not ready.",
      title: "Protocol client unavailable",
    };
  }

  return undefined;
}

async function waitForFinalizationIndexed({
  apiBaseUrl,
  orgId,
}: {
  readonly apiBaseUrl: string;
  readonly orgId: string;
}): Promise<OrganizationFinalizationReadModelDto> {
  const deadline = Date.now() + FINALIZATION_INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const finalization = await loadOrganizationFinalization(apiBaseUrl, orgId);
      if (
        finalization.finalized === true ||
        isOrganizationFinalizedStatus(finalization.finalizationStatus)
      ) {
        return finalization;
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await delay(FINALIZATION_INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: organization #${orgId} did not reflect finalization within ${
      FINALIZATION_INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

function buildFinalizationModalItemId(orgId: string): string {
  return `organization-finalization:${orgId}`;
}

function mapFinalizationStageToTransactionFlowStage(
  stage: OrganizationFinalizationActionStage,
): TransactionFlowStage {
  if (stage === "indexed") {
    return "completed";
  }
  return stage;
}

function parseOrganizationId(orgId: string): bigint | Error {
  try {
    const value = BigInt(orgId);
    if (value < 0n) {
      return new Error("Organization ID must be a non-negative integer.");
    }
    return value;
  } catch {
    return new Error("Organization ID must be a numeric string.");
  }
}
