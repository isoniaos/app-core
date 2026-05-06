import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bytes32Hash, ProposalDto } from "@isonia/types";
import { ProposalStatus } from "@isonia/types";
import { usePublicClient } from "wagmi";
import { DEMO_TARGET_ABI } from "../../chain/proposal-contracts";
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

interface DemoTargetResultPanelProps {
  readonly demoExecution: DemoExecutionState;
  readonly demoNumber: string;
  readonly onRefresh?: () => void;
  readonly proposal: ProposalDto;
  readonly transaction: ProposalActionTransaction;
}

interface DemoTargetResult {
  readonly lastActionHash: Bytes32Hash;
  readonly lastOrgId: string;
  readonly number: string;
}

interface DemoTargetReadState {
  readonly data?: DemoTargetResult;
  readonly error?: string;
  readonly loading: boolean;
}

export function DemoTargetResultPanel({
  demoExecution,
  demoNumber,
  onRefresh,
  proposal,
  transaction,
}: DemoTargetResultPanelProps): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const demoTargetAddress = runtimeConfig.contracts.demoTargetAddress;
  const isDemoTargetProposal = sameAddress(
    proposal.targetAddress,
    demoTargetAddress,
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<DemoTargetReadState>({
    loading: false,
  });

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
    onRefresh?.();
  }, [onRefresh]);

  useEffect(() => {
    if (!demoTargetAddress || !isDemoTargetProposal || !publicClient) {
      setResult({ loading: false });
      return;
    }

    const client = publicClient;
    const address = demoTargetAddress;
    let cancelled = false;

    async function readDemoTarget(): Promise<void> {
      setResult((current) => ({ ...current, loading: true, error: undefined }));
      try {
        const [lastOrgId, number, lastActionHash] = await Promise.all([
          client.readContract({
            address,
            abi: DEMO_TARGET_ABI,
            functionName: "lastOrgId",
          }),
          client.readContract({
            address,
            abi: DEMO_TARGET_ABI,
            functionName: "number",
          }),
          client.readContract({
            address,
            abi: DEMO_TARGET_ABI,
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

    void readDemoTarget();

    return () => {
      cancelled = true;
    };
  }, [
    demoTargetAddress,
    isDemoTargetProposal,
    proposal.status,
    publicClient,
    refreshToken,
    transaction.stage,
  ]);

  const match = useMemo(
    () =>
      getDemoTargetMatch({
        proposal,
        result: result.data,
      }),
    [proposal, result.data],
  );

  if (!demoTargetAddress) {
    return (
      <section className="proposal-demo-result">
        <ResultHeader tone="muted" title="DemoTarget Result" value="Not configured" />
        <div className="route-empty-state">
          <strong>DemoTarget address missing</strong>
          <span>
            Runtime config does not include contracts.demoTargetAddress, so the
            narrow local result check is unavailable.
          </span>
        </div>
      </section>
    );
  }

  if (!isDemoTargetProposal) {
    return (
      <section className="proposal-demo-result">
        <ResultHeader tone="muted" title="DemoTarget Result" value="Not targeted" />
        <div className="route-empty-state">
          <strong>Proposal does not target DemoTarget</strong>
          <span>
            This demo surface only reads the configured DemoTarget.setNumber
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
        title="DemoTarget Result"
        value={match.label}
      />

      <dl className="route-technical-grid proposal-demo-result-grid">
        <RouteDetail
          label="Proposal execution status"
          value={formatLabel(proposal.status)}
        />
        <RouteDetail
          label="Demo target"
          value={formatAddress(demoTargetAddress)}
        />
        <RouteDetail
          label="Expected call"
          value={`DemoTarget.setNumber(org ${proposal.orgId}, ${
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
          label="Last DemoTarget org"
          value={result.data?.lastOrgId ?? "Not read"}
        />
        <RouteDetail
          label="Current DemoTarget number"
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
            blockExplorerUrl={runtimeConfig.blockExplorerUrl}
            txHash={transaction.txHash}
          />
        </div>
      ) : null}

      <div className="proposal-demo-result-footer">
        <div className="proposal-demo-result-state">
          <strong>{match.summary}</strong>
          <span>
            {result.loading
              ? "Reading DemoTarget from the configured chain."
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
        <p>Read-only check of the configured DemoTarget contract.</p>
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

function getDemoTargetMatch({
  proposal,
  result,
}: {
  readonly proposal: ProposalDto;
  readonly result?: DemoTargetResult;
}): {
  readonly detail: string;
  readonly label: string;
  readonly summary: string;
  readonly tone: "success" | "warning" | "danger" | "muted";
} {
  if (!result) {
    return {
      detail: "DemoTarget has not been read yet.",
      label: "Unread",
      summary: "DemoTarget result pending",
      tone: "muted",
    };
  }

  if (proposal.status !== ProposalStatus.Executed) {
    return {
      detail:
        "The proposal is not executed yet. The current DemoTarget value may belong to an earlier demo proposal.",
      label: "Pending execution",
      summary: "Proposal has not reached executed state",
      tone: "warning",
    };
  }

  if (!proposal.dataHash) {
    return {
      detail: "Proposal data hash is missing from the read model.",
      label: "Missing hash",
      summary: "Cannot compare DemoTarget result",
      tone: "danger",
    };
  }

  const actionHashMatches =
    result.lastActionHash.toLowerCase() === proposal.dataHash.toLowerCase();
  const orgMatches = result.lastOrgId === proposal.orgId;

  if (actionHashMatches && orgMatches) {
    return {
      detail:
        "DemoTarget.lastActionHash and lastOrgId match this executed proposal.",
      label: "Matched",
      summary: "DemoTarget reflects this proposal",
      tone: "success",
    };
  }

  return {
    detail:
      "The proposal is executed, but DemoTarget's latest stored action does not match this proposal.",
    label: "Mismatch",
    summary: "DemoTarget does not match this proposal yet",
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

  return "Unable to read DemoTarget result.";
}
