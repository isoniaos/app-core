import { useCallback, useMemo, useRef, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type {
  Address,
  ProposalDto,
  ProposalRouteExplanationDto,
} from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import type { Hex, TransactionReceipt } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { ISO_PROPOSALS_ABI } from "../../chain/proposal-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";
import { useTransactionModal, type TransactionFlowStage } from "../../transactions";
import { useWalletConnection } from "../../wallet/useWalletConnection";

export type ProposalActionKind =
  | "approve"
  | "veto"
  | "queue"
  | "execute"
  | "cancel";

export type ProposalActionStage =
  | "idle"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "indexed"
  | "failed";

export type ProposalActionRequest =
  | {
      readonly kind: "approve";
      readonly bodyId: string;
    }
  | {
      readonly kind: "veto";
      readonly bodyId: string;
    }
  | {
      readonly kind: "queue";
    }
  | {
      readonly kind: "execute";
      readonly actionData: Hex;
      readonly value: bigint;
    }
  | {
      readonly kind: "cancel";
    };

export interface ProposalActionTransaction {
  readonly stage: ProposalActionStage;
  readonly action?: ProposalActionKind;
  readonly bodyId?: string;
  readonly txHash?: `0x${string}`;
  readonly error?: string;
}

export interface ProposalActionReadiness {
  readonly title: string;
  readonly message: string;
}

export interface IndexedProposalActionData {
  readonly proposal: ProposalDto;
  readonly route: ProposalRouteExplanationDto | undefined;
}

interface UseProposalActionOptions {
  readonly proposal: ProposalDto;
  readonly onIndexed?: (data: IndexedProposalActionData) => void;
}

const INDEXER_POLL_INTERVAL_MS = 1_500;
const INDEXER_TIMEOUT_MS = 60_000;

export function useProposalAction({
  onIndexed,
  proposal,
}: UseProposalActionOptions): {
  readonly busy: boolean;
  readonly readiness: ProposalActionReadiness | undefined;
  readonly reset: () => void;
  readonly runAction: (request: ProposalActionRequest) => Promise<void>;
  readonly transaction: ProposalActionTransaction;
} {
  const runtimeConfig = useRuntimeConfig();
  const client = useIsoniaClient();
  const account = useWalletConnection();
  const publicClient = usePublicClient({ chainId: runtimeConfig.activeDeployment.chainId });
  const { writeContractAsync } = useWriteContract();
  const {
    openSingle: openTransactionModal,
    reset: resetTransactionModal,
    updateItem: updateTransactionModalItem,
  } = useTransactionModal();
  const activeTransactionModalItemId = useRef<string | undefined>(undefined);
  const executeActionRef = useRef<
    | ((request: ProposalActionRequest, itemId: string) => Promise<void>)
    | undefined
  >(undefined);
  const [transaction, setTransaction] = useState<ProposalActionTransaction>({
    stage: "idle",
  });

  const readiness = useMemo(
    () =>
      getReadiness({
        accountChainId: account.chainId,
        connected: account.isConnected,
        isoProposalsAddress: runtimeConfig.activeDeployment.contracts.isoProposalsAddress,
        publicClientReady: Boolean(publicClient),
        runtimeChainId: runtimeConfig.activeDeployment.chainId,
        writeActionsEnabled: runtimeConfig.features.writeActions,
      }),
    [
      account.chainId,
      account.isConnected,
      publicClient,
      runtimeConfig.activeDeployment.chainId,
      runtimeConfig.activeDeployment.contracts.isoProposalsAddress,
      runtimeConfig.features.writeActions,
    ],
  );

  const busy =
    transaction.stage === "wallet_pending" ||
    transaction.stage === "submitted" ||
    transaction.stage === "confirming" ||
    transaction.stage === "confirmed_waiting_indexer";

  const reset = useCallback(() => {
    setTransaction({ stage: "idle" });
    activeTransactionModalItemId.current = undefined;
    resetTransactionModal();
  }, [resetTransactionModal]);

  const executeAction = useCallback(
    async (
      request: ProposalActionRequest,
      itemId: string,
    ): Promise<void> => {
      activeTransactionModalItemId.current = itemId;
      const bodyId = getRequestBodyId(request);
      const setActionTransaction = (
        next: ProposalActionTransaction,
        patch: {
          readonly retry?: () => Promise<void> | void;
          readonly retryLabel?: string;
        } = {},
      ): void => {
        setTransaction(next);
        updateTransactionModalItem(itemId, {
          blockExplorerUrl: runtimeConfig.activeDeployment.blockExplorerUrl,
          error: next.error,
          retry: undefined,
          retryLabel: undefined,
          stage: mapProposalActionStageToTransactionFlowStage(next.stage),
          txHash: next.txHash,
          ...patch,
        });
      };
      const fail = (
        error: string,
        txHash?: `0x${string}`,
      ): void => {
        setActionTransaction(
          {
            action: request.kind,
            bodyId,
            error,
            stage: "failed",
            txHash,
          },
          {
            retry: () => executeActionRef.current?.(request, itemId),
            retryLabel: `Retry ${actionLabel(request.kind)}`,
          },
        );
      };

      if (!runtimeConfig.features.writeActions) {
        fail("Proposal write actions are disabled by runtime config.");
        return;
      }

      const signerAddress = account.address;
      if (!account.isConnected || !signerAddress) {
        fail("Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.activeDeployment.chainId) {
        fail(
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.activeDeployment.chainId}.`,
        );
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.activeDeployment.contracts.isoProposalsAddress)) {
        fail("IsoProposals contract address is missing from runtime config.");
        return;
      }

      if (!publicClient) {
        fail("Wallet client is unavailable for the configured chain.");
        return;
      }

      const parsedIds = parseActionIds(proposal, request);
      if (parsedIds instanceof Error) {
        fail(parsedIds.message);
        return;
      }

      let txHash: `0x${string}` | undefined;
      try {
        setActionTransaction({
          action: request.kind,
          bodyId,
          stage: "wallet_pending",
        });
        txHash = await writeProposalAction({
          account: signerAddress,
          address: runtimeConfig.activeDeployment.contracts.isoProposalsAddress,
          chainId: runtimeConfig.activeDeployment.chainId,
          ids: parsedIds,
          request,
          writeContractAsync,
        });

        setActionTransaction({
          action: request.kind,
          bodyId,
          stage: "submitted",
          txHash,
        });
        setActionTransaction({
          action: request.kind,
          bodyId,
          stage: "confirming",
          txHash,
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        assertSuccessfulReceipt(receipt);
        setActionTransaction({
          action: request.kind,
          bodyId,
          stage: "confirmed_waiting_indexer",
          txHash,
        });

        const indexed = await waitForIndexedAction({
          client,
          orgId: proposal.orgId,
          proposalId: proposal.proposalId,
          request,
        });

        setActionTransaction({
          action: request.kind,
          bodyId,
          stage: "indexed",
          txHash,
        });
        onIndexed?.(indexed);
      } catch (error: unknown) {
        fail(normalizeTransactionError(error), txHash);
      }
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      client,
      onIndexed,
      proposal,
      publicClient,
      runtimeConfig.activeDeployment.blockExplorerUrl,
      runtimeConfig.activeDeployment.chainId,
      runtimeConfig.activeDeployment.contracts.isoProposalsAddress,
      runtimeConfig.features.writeActions,
      updateTransactionModalItem,
      writeContractAsync,
    ],
  );

  executeActionRef.current = executeAction;

  const runAction = useCallback(
    async (request: ProposalActionRequest): Promise<void> => {
      const itemId = buildProposalActionTransactionModalItemId(proposal, request);
      const bodyId = getRequestBodyId(request);
      activeTransactionModalItemId.current = itemId;
      setTransaction({ action: request.kind, bodyId, stage: "idle" });
      openTransactionModal({
        description: getProposalActionModalDescription(request),
        item: {
          blockExplorerUrl: runtimeConfig.activeDeployment.blockExplorerUrl,
          description: getProposalActionModalItemDescription(request),
          execute: () => executeActionRef.current?.(request, itemId),
          executeLabel: actionLabel(request.kind),
          id: itemId,
          stage: "idle",
          title: actionLabel(request.kind),
        },
        title: `${actionLabel(request.kind)} proposal`,
      });
    },
    [openTransactionModal, proposal, runtimeConfig.activeDeployment.blockExplorerUrl],
  );

  return { busy, readiness, reset, runAction, transaction };
}

interface ParsedActionIds {
  readonly orgId: bigint;
  readonly proposalId: bigint;
  readonly bodyId?: bigint;
}

function buildProposalActionTransactionModalItemId(
  proposal: ProposalDto,
  request: ProposalActionRequest,
): string {
  return [
    "proposal-action",
    proposal.orgId,
    proposal.proposalId,
    request.kind,
    getRequestBodyId(request) ?? "route",
  ].join(":");
}

function getProposalActionModalDescription(
  request: ProposalActionRequest,
): string {
  if (request.kind === "approve") {
    return "Approve this proposal through the selected governance body.";
  }
  if (request.kind === "veto") {
    return "Record a veto through the selected governance body.";
  }
  if (request.kind === "queue") {
    return "Queue the approved proposal and wait for Control Plane indexing.";
  }
  if (request.kind === "execute") {
    return "Execute the proposal action and wait for Control Plane indexing.";
  }
  return "Cancel this proposal and wait for Control Plane indexing.";
}

function getProposalActionModalItemDescription(
  request: ProposalActionRequest,
): string {
  if (request.kind === "approve" || request.kind === "veto") {
    return `Body #${request.bodyId}`;
  }
  return "Proposal lifecycle transaction";
}

function getRequestBodyId(request: ProposalActionRequest): string | undefined {
  return request.kind === "approve" || request.kind === "veto"
    ? request.bodyId
    : undefined;
}

function mapProposalActionStageToTransactionFlowStage(
  stage: ProposalActionStage,
): TransactionFlowStage {
  if (stage === "indexed") {
    return "completed";
  }
  return stage;
}

function parseActionIds(
  proposal: ProposalDto,
  request: ProposalActionRequest,
): ParsedActionIds | Error {
  const orgId = parseUint(proposal.orgId, "Organization ID");
  if (orgId instanceof Error) {
    return orgId;
  }

  const proposalId = parseUint(proposal.proposalId, "Proposal ID");
  if (proposalId instanceof Error) {
    return proposalId;
  }

  if (request.kind !== "approve" && request.kind !== "veto") {
    return { orgId, proposalId };
  }

  const bodyId = parseUint(request.bodyId, "Body ID");
  return bodyId instanceof Error ? bodyId : { orgId, proposalId, bodyId };
}

async function writeProposalAction({
  account,
  address,
  chainId,
  ids,
  request,
  writeContractAsync,
}: {
  readonly account: Address;
  readonly address: Address;
  readonly chainId: number;
  readonly ids: ParsedActionIds;
  readonly request: ProposalActionRequest;
  readonly writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
}): Promise<`0x${string}`> {
  if (request.kind === "approve") {
    if (ids.bodyId === undefined) {
      throw new Error("Approval body is required.");
    }
    return writeContractAsync({
      address,
      abi: ISO_PROPOSALS_ABI,
      functionName: "approveProposal",
      args: [ids.orgId, ids.proposalId, ids.bodyId],
      chainId,
      account,
    });
  }

  if (request.kind === "veto") {
    if (ids.bodyId === undefined) {
      throw new Error("Veto body is required.");
    }
    return writeContractAsync({
      address,
      abi: ISO_PROPOSALS_ABI,
      functionName: "vetoProposal",
      args: [ids.orgId, ids.proposalId, ids.bodyId],
      chainId,
      account,
    });
  }

  if (request.kind === "queue") {
    return writeContractAsync({
      address,
      abi: ISO_PROPOSALS_ABI,
      functionName: "queueProposal",
      args: [ids.orgId, ids.proposalId],
      chainId,
      account,
    });
  }

  if (request.kind === "execute") {
    return writeContractAsync({
      address,
      abi: ISO_PROPOSALS_ABI,
      functionName: "executeProposal",
      args: [ids.orgId, ids.proposalId, request.actionData],
      chainId,
      account,
      value: request.value,
    });
  }

  return writeContractAsync({
    address,
    abi: ISO_PROPOSALS_ABI,
    functionName: "cancelProposal",
    args: [ids.orgId, ids.proposalId],
    chainId,
    account,
  });
}

function assertSuccessfulReceipt(receipt: TransactionReceipt): void {
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

async function waitForIndexedAction({
  client,
  orgId,
  proposalId,
  request,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly orgId: string;
  readonly proposalId: string;
  readonly request: ProposalActionRequest;
}): Promise<IndexedProposalActionData> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const [proposal, route] = await Promise.all([
        client.getProposal(orgId, proposalId),
        loadRoute(client, orgId, proposalId),
      ]);

      if (isActionIndexed(request, proposal, route)) {
        return { proposal, route };
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: proposal #${proposalId} did not reflect ${actionLabel(
      request.kind,
    ).toLowerCase()} within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

async function loadRoute(
  client: IsoniaControlPlaneClient,
  orgId: string,
  proposalId: string,
): Promise<ProposalRouteExplanationDto | undefined> {
  try {
    return await client.getProposalRoute(orgId, proposalId);
  } catch {
    return undefined;
  }
}

function isActionIndexed(
  request: ProposalActionRequest,
  proposal: ProposalDto,
  route: ProposalRouteExplanationDto | undefined,
): boolean {
  if (request.kind === "approve") {
    return Boolean(
      route?.requiredApprovalBodies.some(
        (body) => body.bodyId === request.bodyId && body.approved,
      ),
    );
  }

  if (request.kind === "veto") {
    return (
      proposal.status === ProposalStatus.Vetoed ||
      Boolean(
        route?.vetoBodies.some(
          (body) => body.bodyId === request.bodyId && body.vetoed,
        ),
      )
    );
  }

  if (request.kind === "queue") {
    return proposal.status === ProposalStatus.Queued;
  }

  if (request.kind === "execute") {
    return proposal.status === ProposalStatus.Executed;
  }

  return proposal.status === ProposalStatus.Cancelled;
}

function getReadiness({
  accountChainId,
  connected,
  isoProposalsAddress,
  publicClientReady,
  runtimeChainId,
  writeActionsEnabled,
}: {
  readonly accountChainId: number | undefined;
  readonly connected: boolean;
  readonly isoProposalsAddress: Address | undefined;
  readonly publicClientReady: boolean;
  readonly runtimeChainId: number;
  readonly writeActionsEnabled: boolean;
}): ProposalActionReadiness | undefined {
  if (!writeActionsEnabled) {
    return {
      title: "Write actions disabled",
      message: "Enable features.writeActions in runtime config.",
    };
  }

  if (!isConfiguredAddress(isoProposalsAddress)) {
    return {
      title: "Protocol config missing",
      message: "Set activeDeployment.contracts.isoProposalsAddress in runtime config.",
    };
  }

  if (!connected) {
    return {
      title: "Wallet not connected",
      message: "Connect a wallet before submitting a proposal action.",
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

function isConfiguredAddress(value: Address | undefined): value is Address {
  return typeof value === "string" && !/^0x0{40}$/i.test(value);
}

function parseUint(value: string, label: string): bigint | Error {
  if (!/^\d+$/.test(value)) {
    return new Error(`${label} must be a non-negative integer.`);
  }

  try {
    return BigInt(value);
  } catch {
    return new Error(`${label} is too large.`);
  }
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

export function actionLabel(action: ProposalActionKind): string {
  if (action === "approve") {
    return "Approve";
  }
  if (action === "veto") {
    return "Veto";
  }
  if (action === "queue") {
    return "Queue";
  }
  if (action === "execute") {
    return "Execute";
  }
  return "Cancel";
}
