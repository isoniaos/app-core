import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bytes32Hash, ProposalDto } from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import { usePublicClient } from "wagmi";
import { LOCAL_DEMO_TARGET_ABI } from "../../chain/proposal-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";
import type { DemoExecutionState } from "../../protocol/demo-proposal-action";
import { SetupTransactionHash } from "../setup/SetupTransactionStatus";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatLabel,
  formatNumericString,
} from "../../utils/format";
import type { ProposalActionTransaction } from "./useProposalAction";

interface LocalDemoTargetResultPanelProps {
  readonly demoExecution: DemoExecutionState;
  readonly demoNumber: string;
  readonly onRefresh?: () => void;
  readonly proposal: ProposalDto;
  readonly transaction: ProposalActionTransaction;
}

interface LocalDemoTargetResult {
  readonly lastActionHash: Bytes32Hash;
  readonly lastOrgId: string;
  readonly number: string;
}

interface LocalDemoTargetReadState {
  readonly data?: LocalDemoTargetResult;
  readonly error?: string;
  readonly loading: boolean;
}

export function LocalDemoTargetResultPanel({
  demoExecution,
  demoNumber,
  onRefresh,
  proposal,
  transaction,
}: LocalDemoTargetResultPanelProps): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const publicClient = usePublicClient({ chainId: runtimeConfig.activeDeployment.chainId });
  const localDemoTargetAddress = runtimeConfig.activeDeployment.localDemoTargetAddress;
  const isLocalDemoTargetProposal = sameAddress(
    proposal.targetAddress,
    localDemoTargetAddress,
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<LocalDemoTargetReadState>({
    loading: false,
  });

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
    onRefresh?.();
  }, [onRefresh]);

  useEffect(() => {
    if (!localDemoTargetAddress || !isLocalDemoTargetProposal || !publicClient) {
      setResult({ loading: false });
      return;
    }

    const client = publicClient;
    const address = localDemoTargetAddress;
    let cancelled = false;

    async function readLocalDemoTarget(): Promise<void> {
      setResult((current) => ({ ...current, loading: true, error: undefined }));
      try {
        const [lastOrgId, number, lastActionHash] = await Promise.all([
          client.readContract({
            address,
            abi: LOCAL_DEMO_TARGET_ABI,
            functionName: "lastOrgId",
          }),
          client.readContract({
            address,
            abi: LOCAL_DEMO_TARGET_ABI,
            functionName: "number",
          }),
          client.readContract({
            address,
            abi: LOCAL_DEMO_TARGET_ABI,
            functionName: "lastActionHash",
          }),
        ]);

        if (cancelled) {
          return;
        }

        setResult({
          loading: false,
          data: {
            lastOrgId: lastOrgId.toString(),
            number: number.toString(),
            lastActionHash: lastActionHash as Bytes32Hash,
          },
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setResult({ loading: false, error: getErrorMessage(error) });
        }
      }
    }

    void readLocalDemoTarget();

    return () => {
      cancelled = true;
    };
  }, [
    localDemoTargetAddress,
    isLocalDemoTargetProposal,
    proposal.status,
    publicClient,
    refreshToken,
    transaction.stage,
  ]);

  const match = useMemo(
    () =>
      getLocalDemoTargetMatch({
        proposal,
        result: result.data,
      }),
    [proposal, result.data],
  );

  if (!localDemoTargetAddress) {
    return (
      <section className="proposal-demo-result">
        <ResultHeader tone="muted" title="Local Demo Target Result" value="Not configured" />
        <div className="route-empty-state">
          <strong>Local demo target address missing</strong>
          <span>
            Runtime config does not include activeDeployment.localDemoTargetAddress, so the
            narrow local result check is unavailable.
          </span>
        </div>
      </section>
    );
  }

  if (!isLocalDemoTargetProposal) {
    return (
      <section className="proposal-demo-result">
        <ResultHeader tone="muted" title="Local Demo Target Result" value="Not targeted" />
        <div className="route-empty-state">
          <strong>Proposal does not target the local demo target</strong>
          <span>
            This demo surface only reads the configured local demo target setNumber
            result. It does not build or execute arbitrary calldata.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="proposal-demo-result">
      <ResultHeader
        tone={match.tone}
        title="Local Demo Target Result"
        value={match.label}
      />

      <dl className="route-technical-grid proposal-demo-result-grid">
        <RouteDetail
          label="Proposal execution status"
          value={formatLabel(proposal.status)}
        />
        <RouteDetail
          label="Demo target"
          value={formatAddress(localDemoTargetAddress)}
        />
        <RouteDetail
          label="Expected call"
          value={`local demo target setNumber(org ${proposal.orgId}, ${
            demoNumber.trim() || "number"
          })`}
        />
        <RouteDetail
          label="Action hash status"
          value={demoExecution.ready ? "Entered number matches" : "Needs match"}
        />
        <RouteDetail
          label="Expected data hash"
          value={proposal.dataHash ?? "No proposal data hash"}
        />
        <RouteDetail
          label="Entered demo number"
          value={demoNumber.trim() ? formatNumericString(demoNumber) : "Not set"}
        />
        <RouteDetail
          label="Last local demo target org"
          value={result.data?.lastOrgId ?? "Not read"}
        />
        <RouteDetail
          label="Current local demo target number"
          value={formatNumericString(result.data?.number)}
        />
        <RouteDetail
          label="Last action hash"
          value={result.data?.lastActionHash ?? "Not read"}
        />
      </dl>

      {transaction.action === "execute" && transaction.txHash ? (
        <div className="proposal-demo-transaction">
          <span>Execute transaction</span>
          <SetupTransactionHash
            blockExplorerUrl={runtimeConfig.activeDeployment.blockExplorerUrl}
            txHash={transaction.txHash}
          />
        </div>
      ) : null}

      <div className="proposal-demo-result-footer">
        <div className="proposal-demo-result-state">
          <strong>{match.summary}</strong>
          <span>
            {result.loading
              ? "Reading local demo target from the configured chain."
              : result.error ?? match.detail}
          </span>
        </div>
        <button
          className="button button-small"
          disabled={result.loading}
          type="button"
          onClick={refresh}
        >
          Refresh result
        </button>
      </div>
    </section>
  );
}

function ResultHeader({
  title,
  tone,
  value,
}: {
  readonly title: string;
  readonly tone: "success" | "warning" | "danger" | "muted";
  readonly value: string;
}): JSX.Element {
  return (
    <div className="proposal-demo-result-header">
      <div>
        <h3>{title}</h3>
        <p>Read-only check of the configured local demo target contract.</p>
      </div>
      <StatusBadge tone={tone}>{value}</StatusBadge>
    </div>
  );
}

function RouteDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getLocalDemoTargetMatch({
  proposal,
  result,
}: {
  readonly proposal: ProposalDto;
  readonly result?: LocalDemoTargetResult;
}): {
  readonly detail: string;
  readonly label: string;
  readonly summary: string;
  readonly tone: "success" | "warning" | "danger" | "muted";
} {
  if (!result) {
    return {
      detail: "Local demo target has not been read yet.",
      label: "Unread",
      summary: "Local demo target result pending",
      tone: "muted",
    };
  }

  if (proposal.status !== ProposalStatus.Executed) {
    return {
      detail:
        "The proposal is not executed yet. The current local demo target value may belong to an earlier demo proposal.",
      label: "Pending execution",
      summary: "Proposal has not reached executed state",
      tone: "warning",
    };
  }

  if (!proposal.dataHash) {
    return {
      detail: "Proposal data hash is missing from the read model.",
      label: "Missing hash",
      summary: "Cannot compare local demo target result",
      tone: "danger",
    };
  }

  const actionHashMatches =
    result.lastActionHash.toLowerCase() === proposal.dataHash.toLowerCase();
  const orgMatches = result.lastOrgId === proposal.orgId;

  if (actionHashMatches && orgMatches) {
    return {
      detail:
        "local demo target lastActionHash and lastOrgId match this executed proposal.",
      label: "Matched",
      summary: "Local demo target reflects this proposal",
      tone: "success",
    };
  }

  return {
    detail:
      "The proposal is executed, but the local demo target's latest stored action does not match this proposal.",
    label: "Mismatch",
    summary: "Local demo target does not match this proposal yet",
    tone: "danger",
  };
}

function sameAddress(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
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

  return "Unable to read local demo target result.";
}
