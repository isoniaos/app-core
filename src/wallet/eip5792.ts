import type { Address } from "@isonia/types";
import { numberToHex } from "viem";
import type { PreparedContractCall } from "../transactions/prepared-contract-call";

export type Eip5792CapabilityStatus = "supported" | "unsupported" | "unknown";
export type Eip5792AtomicStatus = "supported" | "ready" | "unsupported";

export interface Eip5792Provider {
  request(args: {
    readonly method: string;
    readonly params?: readonly unknown[] | object;
  }): Promise<unknown>;
}

export interface Eip5792CapabilityDetails {
  readonly atomicStatus?: Eip5792AtomicStatus;
  readonly capabilityNames: readonly string[];
  readonly chainCapabilities: Readonly<Record<string, unknown>>;
  readonly chainIdHex: `0x${string}`;
}

export interface Eip5792CapabilityDetection {
  readonly atomicRequired: boolean;
  readonly canSendCalls: boolean;
  readonly details?: Eip5792CapabilityDetails;
  readonly error?: string;
  readonly reason: string;
  readonly status: Eip5792CapabilityStatus;
}

export interface Eip5792CallReceipt {
  readonly status?: `0x${string}`;
  readonly transactionHash?: `0x${string}`;
}

export interface Eip5792CallsStatus {
  readonly atomic?: boolean;
  readonly capabilities?: Readonly<Record<string, unknown>>;
  readonly chainId?: `0x${string}`;
  readonly id?: string;
  readonly receipts: readonly Eip5792CallReceipt[];
  readonly status: number;
  readonly version?: string;
}

export interface Eip5792SendCallsResult {
  readonly capabilities?: Readonly<Record<string, unknown>>;
  readonly id: string;
}

export const EIP5792_BATCH_VERSION = "2.0.0";

const METHOD_NOT_FOUND_CODES = new Set([-32601, 4200]);
const GLOBAL_CHAIN_CAPABILITIES_KEY = "0x0";
const DEFAULT_STATUS_POLL_INTERVAL_MS = 2_000;
const DEFAULT_STATUS_TIMEOUT_MS = 90_000;

export async function getEip5792ProviderFromConnector(
  connector: unknown,
): Promise<Eip5792Provider | undefined> {
  if (!connector || typeof connector !== "object") {
    return undefined;
  }

  const getProvider = (connector as { readonly getProvider?: unknown })
    .getProvider;
  if (typeof getProvider !== "function") {
    return undefined;
  }

  try {
    const provider = await getProvider.call(connector);
    return isEip5792Provider(provider) ? provider : undefined;
  } catch {
    return undefined;
  }
}

export async function detectEip5792Capabilities({
  accountChainId,
  address,
  chainId,
  connected,
  provider,
}: {
  readonly accountChainId?: number;
  readonly address?: Address;
  readonly chainId: number;
  readonly connected: boolean;
  readonly provider?: Eip5792Provider;
}): Promise<Eip5792CapabilityDetection> {
  const chainIdHex = toEip5792ChainIdHex(chainId);

  if (!connected || !address) {
    return unsupported("Connect a wallet before checking batch support.");
  }

  if (accountChainId !== chainId) {
    return unsupported(
      `Wallet is connected to chain ${String(accountChainId)}; expected chain ${chainId}.`,
    );
  }

  if (!provider) {
    return unsupported("Wallet provider is unavailable.");
  }

  try {
    const value = await provider.request({
      method: "wallet_getCapabilities",
      params: [address, [chainIdHex]],
    });
    const capabilities = parseCapabilitiesResult(value);
    if (!capabilities) {
      return unknown(
        "Wallet returned malformed EIP-5792 capabilities.",
        "Malformed wallet_getCapabilities response.",
      );
    }

    const chainCapabilities = getChainCapabilities(capabilities, chainIdHex);
    const atomic = readAtomicCapability(chainCapabilities);
    const details: Eip5792CapabilityDetails = {
      atomicStatus: atomic,
      capabilityNames: Object.keys(chainCapabilities).sort(),
      chainCapabilities,
      chainIdHex,
    };

    if (!atomic) {
      return {
        atomicRequired: false,
        canSendCalls: false,
        details,
        reason:
          "Wallet does not advertise EIP-5792 batch capability for this chain.",
        status: "unsupported",
      };
    }

    return {
      atomicRequired: atomic === "supported",
      canSendCalls: true,
      details,
      reason: `Wallet reports EIP-5792 atomic capability: ${atomic}.`,
      status: "supported",
    };
  } catch (error: unknown) {
    if (isUnsupportedMethodError(error)) {
      return unsupported("Wallet does not support wallet_getCapabilities.");
    }

    return unknown(
      "Unable to verify EIP-5792 wallet capabilities.",
      getErrorMessage(error),
    );
  }
}

export async function sendEip5792Calls({
  atomicRequired,
  calls,
  from,
  provider,
}: {
  readonly atomicRequired: boolean;
  readonly calls: readonly PreparedContractCall[];
  readonly from: Address;
  readonly provider: Eip5792Provider;
}): Promise<Eip5792SendCallsResult> {
  const firstChainId = calls[0]?.chainId;
  if (!firstChainId) {
    throw new Error("No prepared calls are available for wallet_sendCalls.");
  }

  if (!calls.every((call) => call.chainId === firstChainId)) {
    throw new Error("EIP-5792 batch prototype only supports one chain.");
  }

  const response = await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        atomicRequired,
        calls: calls.map((call) => ({
          data: call.data,
          to: call.to,
          value: call.value,
        })),
        chainId: toEip5792ChainIdHex(firstChainId),
        from,
        version: EIP5792_BATCH_VERSION,
      },
    ],
  });

  const result = parseSendCallsResult(response);
  if (!result) {
    throw new Error("Wallet returned malformed wallet_sendCalls result.");
  }
  return result;
}

export async function getEip5792CallsStatus({
  id,
  provider,
}: {
  readonly id: string;
  readonly provider: Eip5792Provider;
}): Promise<Eip5792CallsStatus> {
  const response = await provider.request({
    method: "wallet_getCallsStatus",
    params: [id],
  });
  const status = parseCallsStatus(response);
  if (!status) {
    throw new Error("Wallet returned malformed wallet_getCallsStatus result.");
  }
  return status;
}

export async function pollEip5792CallsStatus({
  id,
  intervalMs = DEFAULT_STATUS_POLL_INTERVAL_MS,
  onStatus,
  provider,
  timeoutMs = DEFAULT_STATUS_TIMEOUT_MS,
}: {
  readonly id: string;
  readonly intervalMs?: number;
  readonly onStatus?: (status: Eip5792CallsStatus) => void;
  readonly provider: Eip5792Provider;
  readonly timeoutMs?: number;
}): Promise<Eip5792CallsStatus> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getEip5792CallsStatus({ id, provider });
    onStatus?.(status);
    if (isTerminalCallsStatus(status)) {
      return status;
    }
    await delay(intervalMs);
  }

  throw new Error(
    `Wallet batch status timed out after ${Math.round(timeoutMs / 1_000)} seconds.`,
  );
}

export function isSuccessfulCallsStatus(status: Eip5792CallsStatus): boolean {
  return status.status >= 200 && status.status < 300;
}

export function isTerminalCallsStatus(status: Eip5792CallsStatus): boolean {
  return status.status >= 200;
}

export function extractEip5792TransactionHashes(
  status: Eip5792CallsStatus,
): readonly `0x${string}`[] {
  const hashes = status.receipts
    .map((receipt) => receipt.transactionHash)
    .filter((hash): hash is `0x${string}` => Boolean(hash));
  return [...new Set(hashes)];
}

export function formatEip5792Error(error: unknown): string {
  const message = getErrorMessage(error);

  if (/user rejected|rejected request|denied/i.test(message)) {
    return "Wallet batch request was rejected.";
  }

  if (isUnsupportedMethodError(error)) {
    return "Wallet does not support this EIP-5792 method.";
  }

  return message;
}

export function toEip5792ChainIdHex(chainId: number): `0x${string}` {
  return numberToHex(chainId);
}

function unsupported(reason: string): Eip5792CapabilityDetection {
  return {
    atomicRequired: false,
    canSendCalls: false,
    reason,
    status: "unsupported",
  };
}

function unknown(
  reason: string,
  error: string,
): Eip5792CapabilityDetection {
  return {
    atomicRequired: false,
    canSendCalls: false,
    error,
    reason,
    status: "unknown",
  };
}

function isEip5792Provider(value: unknown): value is Eip5792Provider {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { readonly request?: unknown }).request === "function"
  );
}

function parseCapabilitiesResult(
  value: unknown,
): Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const parsed: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [chainId, capabilities] of Object.entries(value)) {
    if (isHexString(chainId) && isRecord(capabilities)) {
      parsed[chainId.toLowerCase()] = capabilities;
    }
  }

  return parsed;
}

function getChainCapabilities(
  capabilities: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  chainIdHex: `0x${string}`,
): Readonly<Record<string, unknown>> {
  return {
    ...(capabilities[GLOBAL_CHAIN_CAPABILITIES_KEY] ?? {}),
    ...(capabilities[chainIdHex.toLowerCase()] ?? {}),
  };
}

function readAtomicCapability(
  capabilities: Readonly<Record<string, unknown>>,
): Eip5792AtomicStatus | undefined {
  const atomic = capabilities.atomic;
  if (!isRecord(atomic)) {
    return undefined;
  }

  return atomic.status === "supported" ||
    atomic.status === "ready" ||
    atomic.status === "unsupported"
    ? atomic.status
    : undefined;
}

function parseSendCallsResult(
  value: unknown,
): Eip5792SendCallsResult | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }

  return {
    capabilities: isRecord(value.capabilities) ? value.capabilities : undefined,
    id: value.id,
  };
}

function parseCallsStatus(value: unknown): Eip5792CallsStatus | undefined {
  if (!isRecord(value) || typeof value.status !== "number") {
    return undefined;
  }

  return {
    atomic: typeof value.atomic === "boolean" ? value.atomic : undefined,
    capabilities: isRecord(value.capabilities) ? value.capabilities : undefined,
    chainId: isHexString(value.chainId) ? value.chainId : undefined,
    id: typeof value.id === "string" ? value.id : undefined,
    receipts: parseCallReceipts(value.receipts),
    status: value.status,
    version: typeof value.version === "string" ? value.version : undefined,
  };
}

function parseCallReceipts(value: unknown): readonly Eip5792CallReceipt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((receipt) => ({
    status: isHexString(receipt.status) ? receipt.status : undefined,
    transactionHash: isHexString(receipt.transactionHash)
      ? receipt.transactionHash
      : undefined,
  }));
}

function isUnsupportedMethodError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "number" && METHOD_NOT_FOUND_CODES.has(code);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return "Unknown wallet error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
