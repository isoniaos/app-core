import { useState } from "react";
import { usePublicClient } from "wagmi";
import { useRuntimeConfig } from "../../config/runtime-config";
import { StatusBadge } from "../../ui/StatusBadge";

interface LocalHardhatTimeControlsProps {
  readonly onAdvanced?: () => void;
}

interface LocalRpcRequest {
  readonly method: string;
  readonly params?: readonly unknown[];
}

interface LocalRpcClient {
  readonly request: (request: LocalRpcRequest) => Promise<unknown>;
}

interface LocalControlStatus {
  readonly message: string;
  readonly tone: "success" | "warning" | "danger" | "muted";
}

export function LocalHardhatTimeControls({
  onAdvanced,
}: LocalHardhatTimeControlsProps): JSX.Element | null {
  const runtimeConfig = useRuntimeConfig();
  const publicClient = usePublicClient({ chainId: runtimeConfig.activeDeployment.chainId });
  const [customSeconds, setCustomSeconds] = useState("300");
  const [busyLabel, setBusyLabel] = useState<string | undefined>();
  const [status, setStatus] = useState<LocalControlStatus>({
    message: "Ready to mine local blocks or move local chain time.",
    tone: "muted",
  });

  if (runtimeConfig.activeDeployment.chainId !== 31_337) {
    return null;
  }

  const busy = busyLabel !== undefined;

  async function mineBlock(): Promise<void> {
    await runLocalControl("Mine block", async (client) => {
      await client.request({ method: "evm_mine" });
      return "Mined one local Hardhat block.";
    });
  }

  async function advanceTime(seconds: number): Promise<void> {
    await runLocalControl(`Advance ${seconds}s`, async (client) => {
      await client.request({
        method: "evm_increaseTime",
        params: [seconds],
      });
      await client.request({ method: "evm_mine" });
      return `Advanced local Hardhat time by ${seconds.toLocaleString()} seconds and mined a block.`;
    });
  }

  async function advanceCustomTime(): Promise<void> {
    const parsed = Number(customSeconds);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      setStatus({
        message: "Custom seconds must be a positive whole number.",
        tone: "danger",
      });
      return;
    }

    await advanceTime(parsed);
  }

  async function runLocalControl(
    label: string,
    action: (client: LocalRpcClient) => Promise<string>,
  ): Promise<void> {
    const client = getLocalRpcClient(publicClient);
    if (!client) {
      setStatus({
        message:
          "The configured local RPC client is unavailable. Check wallet chain and runtime config.",
        tone: "danger",
      });
      return;
    }

    try {
      setBusyLabel(label);
      setStatus({
        message: `${label} request sent to local Hardhat RPC.`,
        tone: "warning",
      });
      const message = await action(client);
      setStatus({ message, tone: "success" });
      onAdvanced?.();
    } catch (error: unknown) {
      setStatus({
        message: getErrorMessage(error),
        tone: "danger",
      });
    } finally {
      setBusyLabel(undefined);
    }
  }

  return (
    <section className="local-hardhat-controls">
      <div className="local-hardhat-header">
        <div>
          <h3>Local Hardhat Time</h3>
          <p>
            Local demo tools only for chainId 31337. These controls are hidden
            on non-local chains and are not production governance features.
          </p>
        </div>
        <StatusBadge tone={busy ? "warning" : status.tone}>
          {busyLabel ?? "Local only"}
        </StatusBadge>
      </div>

      <div className="local-hardhat-actions">
        <button
          className="button button-small"
          disabled={busy}
          type="button"
          onClick={() => {
            void mineBlock();
          }}
        >
          Mine block
        </button>
        <button
          className="button button-small"
          disabled={busy}
          type="button"
          onClick={() => {
            void advanceTime(300);
          }}
        >
          Advance 5 minutes
        </button>
        <button
          className="button button-small"
          disabled={busy}
          type="button"
          onClick={() => {
            void advanceTime(3_600);
          }}
        >
          Advance 1 hour
        </button>
        <label className="form-field local-hardhat-custom">
          <span>Custom seconds</span>
          <input
            inputMode="numeric"
            min="1"
            type="number"
            value={customSeconds}
            onChange={(event) => setCustomSeconds(event.target.value)}
          />
        </label>
        <button
          className="button button-small"
          disabled={busy}
          type="button"
          onClick={() => {
            void advanceCustomTime();
          }}
        >
          Advance custom
        </button>
      </div>

      <div className={`local-hardhat-status local-hardhat-status-${status.tone}`}>
        {status.message}
      </div>
    </section>
  );
}

function getLocalRpcClient(publicClient: unknown): LocalRpcClient | undefined {
  if (!publicClient || typeof publicClient !== "object") {
    return undefined;
  }

  const candidate = publicClient as { readonly request?: unknown };
  if (typeof candidate.request !== "function") {
    return undefined;
  }

  const request = candidate.request as (
    request: LocalRpcRequest,
  ) => Promise<unknown>;

  return {
    request: (rpcRequest) => request.call(publicClient, rpcRequest),
  };
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

  return "Local Hardhat RPC request failed.";
}
