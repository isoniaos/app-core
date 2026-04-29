import { useCallback, useMemo, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type {
  Address,
  ProposalDto,
  ProposalRouteExplanationDto,
} from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import type { Hex, TransactionReceipt } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { GOV_PROPOSALS_ABI } from "../../chain/proposal-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";

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
  const account = useAccount();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const [transaction, setTransaction] = useState<ProposalActionTransaction>({
    stage: "idle",
  });

  const readiness = useMemo(
    () =>
      getReadiness({
        accountChainId: account.chainId,
        connected: account.isConnected,
        govProposalsAddress: runtimeConfig.contracts.govProposalsAddress,
        publicClientReady: Boolean(publicClient),
        runtimeChainId: runtimeConfig.chainId,
        writeActionsEnabled: runtimeConfig.features.writeActions,
      }),
    [
      account.chainId,
      account.isConnected,
      publicClient,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govProposalsAddress,
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
  }, []);

  const runAction = useCallback(
    async (request: ProposalActionRequest): Promise<void> => {
      if (!runtimeConfig.features.writeActions) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: "Proposal write actions are disabled by runtime config.",
        });
        return;
      }

      if (!account.isConnected || !account.address) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: "Wallet is not connected.",
        });
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        });
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.contracts.govProposalsAddress)) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: "GovProposals contract address is missing from runtime config.",
        });
        return;
      }

      if (!publicClient) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: "Wallet client is unavailable for the configured chain.",
        });
        return;
      }

      const parsedIds = parseActionIds(proposal, request);
      if (parsedIds instanceof Error) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: parsedIds.message,
        });
        return;
      }

      try {
        setTransaction({ action: request.kind, stage: "wallet_pending" });
        const txHash = await writeProposalAction({
          address: runtimeConfig.contracts.govProposalsAddress,
          chainId: runtimeConfig.chainId,
          ids: parsedIds,
          request,
          writeContractAsync,
        });

        setTransaction({ action: request.kind, stage: "submitted", txHash });
        setTransaction({ action: request.kind, stage: "confirming", txHash });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        assertSuccessfulReceipt(receipt);
        setTransaction({
          action: request.kind,
          stage: "confirmed_waiting_indexer",
          txHash,
        });

        const indexed = await waitForIndexedAction({
          client,
          orgId: proposal.orgId,
          proposalId: proposal.proposalId,
          request,
        });

        setTransaction({
          action: request.kind,
          stage: "indexed",
          txHash,
        });
        onIndexed?.(indexed);
      } catch (error: unknown) {
        setTransaction({
          action: request.kind,
          stage: "failed",
          error: normalizeTransactionError(error),
        });
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
      runtimeConfig.chainId,
      runtimeConfig.contracts.govProposalsAddress,
      runtimeConfig.features.writeActions,
      writeContractAsync,
    ],
  );

  return { busy, readiness, reset, runAction, transaction };
}

interface ParsedActionIds {
  readonly orgId: bigint;
  readonly proposalId: bigint;
  readonly bodyId?: bigint;
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
  address,
  chainId,
  ids,
  request,
  writeContractAsync,
}: {
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
      abi: GOV_PROPOSALS_ABI,
      functionName: "approveProposal",
      args: [ids.orgId, ids.proposalId, ids.bodyId],
      chainId,
    });
  }

  if (request.kind === "veto") {
    if (ids.bodyId === undefined) {
      throw new Error("Veto body is required.");
    }
    return writeContractAsync({
      address,
      abi: GOV_PROPOSALS_ABI,
      functionName: "vetoProposal",
      args: [ids.orgId, ids.proposalId, ids.bodyId],
      chainId,
    });
  }

  if (request.kind === "queue") {
    return writeContractAsync({
      address,
      abi: GOV_PROPOSALS_ABI,
      functionName: "queueProposal",
      args: [ids.orgId, ids.proposalId],
      chainId,
    });
  }

  if (request.kind === "execute") {
    return writeContractAsync({
      address,
      abi: GOV_PROPOSALS_ABI,
      functionName: "executeProposal",
      args: [ids.orgId, ids.proposalId, request.actionData],
      chainId,
      value: request.value,
    });
  }

  return writeContractAsync({
    address,
    abi: GOV_PROPOSALS_ABI,
    functionName: "cancelProposal",
    args: [ids.orgId, ids.proposalId],
    chainId,
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
  govProposalsAddress,
  publicClientReady,
  runtimeChainId,
  writeActionsEnabled,
}: {
  readonly accountChainId: number | undefined;
  readonly connected: boolean;
  readonly govProposalsAddress: Address;
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

  if (!isConfiguredAddress(govProposalsAddress)) {
    return {
      title: "Protocol config missing",
      message: "Set contracts.govProposalsAddress in runtime config.",
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

function isConfiguredAddress(value: Address): boolean {
  return !/^0x0{40}$/i.test(value);
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
