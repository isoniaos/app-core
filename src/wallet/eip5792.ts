import type { Address } from "@isonia/types";
import { isAddress, numberToHex } from "viem";
import type { PreparedContractCall } from "../transactions/prepared-contract-call";

export type Eip5792CapabilityStatus = "supported" | "unsupported" | "unknown";
export type Eip5792AtomicStatus = "supported" | "ready" | "unsupported";
export type Eip5792MethodName =
  | "wallet_getCapabilities"
  | "wallet_getCallsStatus"
  | "wallet_sendCalls";
export type Eip5792LikelyErrorReason =
  | "eip7702_upgrade_unavailable"
  | "malformed_response"
  | "status_timeout"
  | "unsupported_chain"
  | "unsupported_method"
  | "wallet_rejected"
  | "wrong_provider"
  | "unknown";

export interface Eip5792Provider {
  request(args: {
    readonly method: string;
    readonly params?: readonly unknown[] | object;
  }): Promise<unknown>;
}

export interface Eip5792ConnectorDiagnostics {
  readonly id?: string;
  readonly name?: string;
  readonly rdns?: string;
  readonly type?: string;
  readonly uid?: string;
}

export interface Eip5792ProviderDiagnostics {
  readonly appearsMetaMask: boolean;
  readonly browserEthereumAvailable: boolean;
  readonly browserInjectedProviderCount: number;
  readonly browserMetaMaskAvailable: boolean;
  readonly connector: Eip5792ConnectorDiagnostics;
  readonly genericInjectedConnector: boolean;
  readonly possibleProviderMismatch: boolean;
  readonly providerAvailable: boolean;
  readonly providerFlags: readonly string[];
  readonly providerLabel: string;
  readonly providerRdns?: string;
  readonly providerUuid?: string;
  readonly usingConnectedConnectorProvider: boolean;
}

export interface Eip5792ProviderContext {
  readonly diagnostics: Eip5792ProviderDiagnostics;
  readonly provider?: Eip5792Provider;
}

export interface Eip5792MethodError {
  readonly chainId?: number;
  readonly code?: string;
  readonly connectorName?: string;
  readonly likelyReason: Eip5792LikelyErrorReason;
  readonly message: string;
  readonly method: Eip5792MethodName;
  readonly providerName?: string;
}

export interface Eip5792CapabilityDetails {
  readonly atomicStatus?: Eip5792AtomicStatus;
  readonly capabilityNames: readonly string[];
  readonly chainCapabilities: Readonly<Record<string, unknown>>;
  readonly chainIdHex: `0x${string}`;
  readonly parsedCapabilities: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  readonly rawCapabilities: unknown;
}

export interface Eip5792CapabilityDetection {
  readonly atomicRequired: boolean;
  readonly canSendCalls: boolean;
  readonly checkedAt?: string;
  readonly details?: Eip5792CapabilityDetails;
  readonly diagnostics?: Eip5792ProviderDiagnostics;
  readonly error?: string;
  readonly lastMethodError?: Eip5792MethodError;
  readonly rawCapabilities?: unknown;
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

export interface Eip5792ErrorContext {
  readonly chainId?: number;
  readonly connectorName?: string;
  readonly providerName?: string;
}

export interface Eip5792WalletCallRequest {
  readonly data: `0x${string}`;
  readonly to: Address;
  readonly value?: `0x${string}`;
}

export interface Eip5792SendCallsPayload {
  readonly atomicRequired: boolean;
  readonly calls: readonly Eip5792WalletCallRequest[];
  readonly chainId: `0x${string}`;
  readonly from: Address;
  readonly version: typeof EIP5792_BATCH_VERSION;
}

export const EIP5792_BATCH_VERSION = "2.0.0";

const METHOD_NOT_FOUND_CODES = new Set([-32601, 4200]);
const USER_REJECTED_CODES = new Set([4001]);
const WRONG_PROVIDER_CODES = new Set([4100]);
const UNSUPPORTED_CHAIN_CODES = new Set([4900, 4901, 4902]);
const GLOBAL_CHAIN_CAPABILITIES_KEY = "0x0";
const DEFAULT_STATUS_POLL_INTERVAL_MS = 2_000;
const DEFAULT_STATUS_TIMEOUT_MS = 90_000;
const LOCAL_CHAIN_IDS = new Set([1_337, 31_337]);

export async function getEip5792ProviderFromConnector(
  connector: unknown,
): Promise<Eip5792Provider | undefined> {
  return (await getEip5792ProviderContext(connector)).provider;
}

export async function getEip5792ProviderContext(
  connector: unknown,
): Promise<Eip5792ProviderContext> {
  const connectorDiagnostics = readConnectorDiagnostics(connector);
  let provider: Eip5792Provider | undefined;

  if (connector && typeof connector === "object") {
    const getProvider = (connector as { readonly getProvider?: unknown })
      .getProvider;
    if (typeof getProvider === "function") {
      try {
        const value = await getProvider.call(connector);
        provider = isEip5792Provider(value) ? value : undefined;
      } catch {
        provider = undefined;
      }
    }
  }

  return {
    diagnostics: buildProviderDiagnostics({
      connector: connectorDiagnostics,
      provider,
    }),
    provider,
  };
}

export async function detectEip5792Capabilities({
  accountChainId,
  address,
  chainId,
  connected,
  provider,
  providerDiagnostics,
}: {
  readonly accountChainId?: number;
  readonly address?: Address;
  readonly chainId: number;
  readonly connected: boolean;
  readonly provider?: Eip5792Provider;
  readonly providerDiagnostics?: Eip5792ProviderDiagnostics;
}): Promise<Eip5792CapabilityDetection> {
  const chainIdHex = toEip5792ChainIdHex(chainId);
  const base = {
    checkedAt: new Date().toISOString(),
    diagnostics: providerDiagnostics,
  };

  if (!connected || !address) {
    return unsupported("Connect a wallet before checking batch support.", base);
  }

  if (accountChainId !== chainId) {
    return unsupported(
      `Wallet is connected to chain ${String(accountChainId)}; expected chain ${chainId}.`,
      base,
    );
  }

  if (!provider) {
    return unsupported("Wallet provider is unavailable.", base);
  }

  try {
    const value = await requestEip5792Method({
      context: buildErrorContext(chainId, providerDiagnostics),
      method: "wallet_getCapabilities",
      params: [address, [chainIdHex]],
      provider,
    });
    const capabilities = parseCapabilitiesResult(value);
    if (!capabilities) {
      const lastMethodError = createMethodError(
        new Error("Malformed wallet_getCapabilities response."),
        "wallet_getCapabilities",
        {
          ...buildErrorContext(chainId, providerDiagnostics),
          likelyReason: "malformed_response",
        },
      ).details;
      return unknown(
        "Wallet returned malformed EIP-5792 capabilities.",
        lastMethodError.message,
        {
          ...base,
          lastMethodError,
          rawCapabilities: value,
        },
      );
    }

    const chainCapabilities = getChainCapabilities(capabilities, chainIdHex);
    const atomic = readAtomicCapability(chainCapabilities);
    const details: Eip5792CapabilityDetails = {
      atomicStatus: atomic,
      capabilityNames: Object.keys(chainCapabilities).sort(),
      chainCapabilities,
      chainIdHex,
      parsedCapabilities: capabilities,
      rawCapabilities: value,
    };
    const localChainReason = getLocalChainUnsupportedReason(
      chainId,
      providerDiagnostics,
    );

    if (localChainReason) {
      return {
        ...base,
        atomicRequired: false,
        canSendCalls: false,
        details,
        reason: localChainReason,
        status: "unsupported",
      };
    }

    if (!atomic) {
      return {
        ...base,
        atomicRequired: false,
        canSendCalls: false,
        details,
        reason:
          "Wallet does not advertise EIP-5792 atomic capability for this chain.",
        status: "unsupported",
      };
    }

    if (atomic === "unsupported") {
      return {
        ...base,
        atomicRequired: false,
        canSendCalls: false,
        details,
        reason:
          "Wallet reports EIP-5792 atomic capability is unsupported on this chain.",
        status: "unsupported",
      };
    }

    return {
      ...base,
      atomicRequired: true,
      canSendCalls: true,
      details,
      reason:
        atomic === "ready"
          ? "Wallet can request a MetaMask smart account upgrade before atomic batch execution."
          : "Wallet reports EIP-5792 atomic batch capability is supported.",
      status: "supported",
    };
  } catch (error: unknown) {
    const lastMethodError =
      getEip5792MethodError(error) ??
      createMethodError(error, "wallet_getCapabilities", {
        ...buildErrorContext(chainId, providerDiagnostics),
        likelyReason: isUnsupportedMethodError(error)
          ? "unsupported_method"
          : undefined,
      }).details;

    return lastMethodError.likelyReason === "unsupported_method"
      ? unsupported("Wallet does not support wallet_getCapabilities.", {
          ...base,
          lastMethodError,
        })
      : unknown("Unable to verify EIP-5792 wallet capabilities.", lastMethodError.message, {
          ...base,
          lastMethodError,
        });
  }
}

export async function sendEip5792Calls({
  atomicRequired,
  calls,
  context,
  from,
  provider,
}: {
  readonly atomicRequired: boolean;
  readonly calls: readonly PreparedContractCall[];
  readonly context?: Eip5792ErrorContext;
  readonly from: Address;
  readonly provider: Eip5792Provider;
}): Promise<Eip5792SendCallsResult> {
  const payload = buildEip5792SendCallsPayload({
    atomicRequired,
    calls,
    from,
  });
  const response = await requestEip5792Method({
    context: {
      ...context,
      chainId: context?.chainId ?? calls[0]?.chainId,
    },
    method: "wallet_sendCalls",
    params: [payload],
    provider,
  });
  const result = parseSendCallsResult(response);
  if (!result) {
    throw createMethodError(
      new Error("Wallet returned malformed wallet_sendCalls result."),
      "wallet_sendCalls",
      {
        ...context,
        chainId: context?.chainId ?? calls[0]?.chainId,
        likelyReason: "malformed_response",
      },
    );
  }
  return result;
}

export function buildEip5792SendCallsPayload({
  atomicRequired,
  calls,
  from,
}: {
  readonly atomicRequired: boolean;
  readonly calls: readonly PreparedContractCall[];
  readonly from: Address;
}): Eip5792SendCallsPayload {
  const firstChainId = calls[0]?.chainId;
  if (!firstChainId) {
    throw new Error("No prepared calls are available for wallet_sendCalls.");
  }

  if (!calls.every((call) => call.chainId === firstChainId)) {
    throw new Error("EIP-5792 batch prototype only supports one chain.");
  }

  if (!isAddress(from)) {
    throw new Error("wallet_sendCalls requires a valid from address.");
  }

  return {
    atomicRequired,
    calls: calls.map(normalizeWalletCall),
    chainId: toEip5792ChainIdHex(firstChainId),
    from,
    version: EIP5792_BATCH_VERSION,
  };
}

export async function getEip5792CallsStatus({
  context,
  id,
  provider,
}: {
  readonly context?: Eip5792ErrorContext;
  readonly id: string;
  readonly provider: Eip5792Provider;
}): Promise<Eip5792CallsStatus> {
  const response = await requestEip5792Method({
    context,
    method: "wallet_getCallsStatus",
    params: [id],
    provider,
  });
  const status = parseCallsStatus(response);
  if (!status) {
    throw createMethodError(
      new Error("Wallet returned malformed wallet_getCallsStatus result."),
      "wallet_getCallsStatus",
      {
        ...context,
        likelyReason: "malformed_response",
      },
    );
  }
  return status;
}

export async function pollEip5792CallsStatus({
  context,
  id,
  intervalMs = DEFAULT_STATUS_POLL_INTERVAL_MS,
  onStatus,
  provider,
  timeoutMs = DEFAULT_STATUS_TIMEOUT_MS,
}: {
  readonly context?: Eip5792ErrorContext;
  readonly id: string;
  readonly intervalMs?: number;
  readonly onStatus?: (status: Eip5792CallsStatus) => void;
  readonly provider: Eip5792Provider;
  readonly timeoutMs?: number;
}): Promise<Eip5792CallsStatus> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getEip5792CallsStatus({ context, id, provider });
    onStatus?.(status);
    if (isTerminalCallsStatus(status)) {
      return status;
    }
    await delay(intervalMs);
  }

  throw createMethodError(
    new Error(
      `Wallet batch status timed out after ${Math.round(timeoutMs / 1_000)} seconds.`,
    ),
    "wallet_getCallsStatus",
    {
      ...context,
      likelyReason: "status_timeout",
    },
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

export function formatEip5792Error(
  error: unknown,
  context?: Eip5792ErrorContext,
): string {
  const methodError = getEip5792MethodError(error);
  if (methodError) {
    return formatMethodError(methodError);
  }

  const message = getErrorMessage(error);

  if (/user rejected|rejected request|denied/i.test(message)) {
    return createMethodError(error, "wallet_sendCalls", {
      ...context,
      likelyReason: "wallet_rejected",
    }).message;
  }

  if (isUnsupportedMethodError(error)) {
    return createMethodError(error, "wallet_sendCalls", {
      ...context,
      likelyReason: "unsupported_method",
    }).message;
  }

  return createMethodError(error, "wallet_sendCalls", {
    ...context,
  }).message;
}

export function getEip5792MethodError(
  error: unknown,
): Eip5792MethodError | undefined {
  return error instanceof Eip5792RpcMethodError ? error.details : undefined;
}

export function formatEip5792LikelyReason(
  reason: Eip5792LikelyErrorReason,
): string {
  switch (reason) {
    case "eip7702_upgrade_unavailable":
      return "EIP-7702 or smart account upgrade unavailable";
    case "malformed_response":
      return "Malformed wallet response";
    case "status_timeout":
      return "Status timeout";
    case "unsupported_chain":
      return "Unsupported chain";
    case "unsupported_method":
      return "Unsupported wallet method";
    case "wallet_rejected":
      return "Wallet rejected";
    case "wrong_provider":
      return "Wrong or unauthorized provider";
    case "unknown":
      return "Unknown wallet error";
  }
}

export function toEip5792ChainIdHex(chainId: number): `0x${string}` {
  return numberToHex(chainId);
}

function unsupported(
  reason: string,
  extra?: Partial<Eip5792CapabilityDetection>,
): Eip5792CapabilityDetection {
  return {
    atomicRequired: false,
    canSendCalls: false,
    reason,
    status: "unsupported",
    ...extra,
  };
}

function unknown(
  reason: string,
  error: string,
  extra?: Partial<Eip5792CapabilityDetection>,
): Eip5792CapabilityDetection {
  return {
    atomicRequired: false,
    canSendCalls: false,
    error,
    reason,
    status: "unknown",
    ...extra,
  };
}

async function requestEip5792Method({
  context,
  method,
  params,
  provider,
}: {
  readonly context?: Eip5792ErrorContext;
  readonly method: Eip5792MethodName;
  readonly params: readonly unknown[];
  readonly provider: Eip5792Provider;
}): Promise<unknown> {
  try {
    return await provider.request({ method, params });
  } catch (error: unknown) {
    throw createMethodError(error, method, context);
  }
}

function createMethodError(
  error: unknown,
  method: Eip5792MethodName,
  context?: Eip5792ErrorContext & {
    readonly likelyReason?: Eip5792LikelyErrorReason;
  },
): Eip5792RpcMethodError {
  const likelyReason = context?.likelyReason ?? inferLikelyReason(error);
  const details: Eip5792MethodError = {
    chainId: context?.chainId,
    code: getErrorCode(error),
    connectorName: context?.connectorName,
    likelyReason,
    message: getErrorMessage(error),
    method,
    providerName: context?.providerName,
  };
  return new Eip5792RpcMethodError(details);
}

class Eip5792RpcMethodError extends Error {
  readonly details: Eip5792MethodError;

  constructor(details: Eip5792MethodError) {
    super(formatMethodError(details));
    this.name = "Eip5792RpcMethodError";
    this.details = details;
  }
}

function formatMethodError(error: Eip5792MethodError): string {
  const scope = [
    error.method,
    error.chainId !== undefined ? `chain ${error.chainId}` : undefined,
    error.providerName ? `provider ${error.providerName}` : undefined,
    error.connectorName ? `connector ${error.connectorName}` : undefined,
  ]
    .filter(Boolean)
    .join(" / ");
  const code = error.code ? ` [${error.code}]` : "";
  return `${scope}${code}: ${error.message} Likely reason: ${formatEip5792LikelyReason(error.likelyReason)}.`;
}

function inferLikelyReason(error: unknown): Eip5792LikelyErrorReason {
  const code = getNumericErrorCode(error);
  const message = getErrorMessage(error);

  if (code !== undefined && USER_REJECTED_CODES.has(code)) {
    return "wallet_rejected";
  }
  if (code !== undefined && METHOD_NOT_FOUND_CODES.has(code)) {
    return "unsupported_method";
  }
  if (code !== undefined && UNSUPPORTED_CHAIN_CODES.has(code)) {
    return "unsupported_chain";
  }
  if (code !== undefined && WRONG_PROVIDER_CODES.has(code)) {
    return "wrong_provider";
  }
  if (/user rejected|rejected request|denied/i.test(message)) {
    return "wallet_rejected";
  }
  if (/method .*not (found|supported)|unsupported method/i.test(message)) {
    return "unsupported_method";
  }
  if (/unsupported chain|unsupported network|chain .*not supported/i.test(message)) {
    return "unsupported_chain";
  }
  if (/smart account|eip-?7702|upgrade|delegation/i.test(message)) {
    return "eip7702_upgrade_unavailable";
  }
  if (/unauthorized|wrong provider|provider/i.test(message)) {
    return "wrong_provider";
  }
  return "unknown";
}

function buildErrorContext(
  chainId: number,
  diagnostics: Eip5792ProviderDiagnostics | undefined,
): Eip5792ErrorContext {
  return {
    chainId,
    connectorName: diagnostics?.connector.name ?? diagnostics?.connector.id,
    providerName: diagnostics?.providerLabel,
  };
}

function normalizeWalletCall(
  call: PreparedContractCall,
): Eip5792WalletCallRequest {
  if (!isAddress(call.to)) {
    throw new Error(`Invalid wallet_sendCalls call target: ${call.to}`);
  }

  if (!isHexString(call.data)) {
    throw new Error(`Invalid wallet_sendCalls calldata for ${call.title}.`);
  }

  const value = normalizeCallValue(call.value, call.title);
  return value === undefined
    ? {
        data: call.data,
        to: call.to,
      }
    : {
        data: call.data,
        to: call.to,
        value,
      };
}

function normalizeCallValue(
  value: `0x${string}` | undefined,
  title: string,
): `0x${string}` | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isHexQuantity(value)) {
    throw new Error(`Invalid wallet_sendCalls value for ${title}.`);
  }

  return hexQuantityToBigInt(value) === 0n ? undefined : value;
}

function readConnectorDiagnostics(
  connector: unknown,
): Eip5792ConnectorDiagnostics {
  if (!connector || typeof connector !== "object") {
    return {};
  }
  const record = connector as Record<string, unknown>;

  return {
    id: readString(record.id),
    name: readString(record.name),
    rdns: readRdns(record.rdns),
    type: readString(record.type),
    uid: readString(record.uid),
  };
}

function buildProviderDiagnostics({
  connector,
  provider,
}: {
  readonly connector: Eip5792ConnectorDiagnostics;
  readonly provider?: Eip5792Provider;
}): Eip5792ProviderDiagnostics {
  const providerRecord = isRecord(provider) ? provider : undefined;
  const providerInfo = isRecord(providerRecord?.info)
    ? providerRecord.info
    : undefined;
  const providerRdns = readString(providerInfo?.rdns) ?? connector.rdns;
  const providerName =
    readString(providerInfo?.name) ??
    connector.name ??
    (providerRecord ? "Injected provider" : "Unavailable");
  const providerFlags = readProviderFlags(providerRecord);
  const browserProviders = getBrowserInjectedProviders();
  const browserMetaMaskAvailable = browserProviders.some(appearsMetaMask);
  const providerAppearsMetaMask =
    appearsMetaMask(provider) ||
    providerRdns === "io.metamask" ||
    connector.rdns === "io.metamask";
  const genericInjectedConnector = isGenericInjectedConnector(connector);

  return {
    appearsMetaMask: providerAppearsMetaMask,
    browserEthereumAvailable: browserProviders.length > 0,
    browserInjectedProviderCount: browserProviders.length,
    browserMetaMaskAvailable,
    connector,
    genericInjectedConnector,
    possibleProviderMismatch:
      genericInjectedConnector &&
      browserMetaMaskAvailable &&
      !providerAppearsMetaMask,
    providerAvailable: Boolean(provider),
    providerFlags,
    providerLabel: providerName,
    providerRdns,
    providerUuid: readString(providerInfo?.uuid),
    usingConnectedConnectorProvider: Boolean(provider),
  };
}

function getBrowserInjectedProviders(): readonly unknown[] {
  if (typeof window === "undefined") {
    return [];
  }

  const ethereum = (window as { readonly ethereum?: unknown }).ethereum;
  if (!ethereum) {
    return [];
  }

  if (isRecord(ethereum) && Array.isArray(ethereum.providers)) {
    return ethereum.providers;
  }

  return [ethereum];
}

function readProviderFlags(
  provider: Readonly<Record<string, unknown>> | undefined,
): readonly string[] {
  if (!provider) {
    return [];
  }

  return [
    "isMetaMask",
    "isBraveWallet",
    "isCoinbaseWallet",
    "isRabby",
    "isFrame",
    "isTrust",
    "isPhantom",
  ].filter((key) => provider[key] === true);
}

function appearsMetaMask(provider: unknown): boolean {
  if (!isRecord(provider)) {
    return false;
  }

  const info = isRecord(provider.info) ? provider.info : undefined;
  return (
    readString(info?.rdns) === "io.metamask" ||
    readString(info?.name)?.toLowerCase().includes("metamask") === true ||
    provider.isMetaMask === true
  );
}

function isGenericInjectedConnector(
  connector: Eip5792ConnectorDiagnostics,
): boolean {
  return (
    connector.id === "injected" ||
    connector.type === "injected" ||
    connector.name?.toLowerCase() === "injected"
  );
}

function getLocalChainUnsupportedReason(
  chainId: number,
  diagnostics: Eip5792ProviderDiagnostics | undefined,
): string | undefined {
  if (!LOCAL_CHAIN_IDS.has(chainId)) {
    return undefined;
  }

  return diagnostics?.appearsMetaMask
    ? "MetaMask batch activation is not available on this local chain. Use serial execution."
    : "Wallet batch activation is not enabled on this local chain. Use serial execution.";
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
  const code = getNumericErrorCode(error);
  return code !== undefined && METHOD_NOT_FOUND_CODES.has(code);
}

function getNumericErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const code = (error as { readonly code?: unknown }).code;
  if (typeof code === "number") {
    return code;
  }
  if (typeof code === "string") {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "number" || typeof code === "string"
    ? String(code)
    : undefined;
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readRdns(value: unknown): string | undefined {
  if (typeof value === "string") {
    return readString(value);
  }
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

function isHexQuantity(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value);
}

function hexQuantityToBigInt(value: `0x${string}`): bigint {
  return BigInt(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
