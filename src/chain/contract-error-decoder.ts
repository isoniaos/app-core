import {
  decodeErrorResult,
  type Abi,
  type Hex,
} from "viem";
import { ISONIA_PROTOCOL_ERROR_ABI } from "./protocol-errors";

export interface DecodedContractError {
  readonly data: Hex;
  readonly message: string;
  readonly name: string;
  readonly nested?: DecodedContractError;
}

const STANDARD_SOLIDITY_ERROR_ABI = [
  {
    type: "error",
    name: "Error",
    inputs: [{ name: "message", type: "string" }],
  },
  {
    type: "error",
    name: "Panic",
    inputs: [{ name: "code", type: "uint256" }],
  },
] as const satisfies Abi;

const ERROR_DATA_KEYS = [
  "data",
  "error",
  "cause",
  "details",
  "message",
  "shortMessage",
  "metaMessages",
] as const;

interface AbiErrorItem {
  readonly inputs?: readonly {
    readonly name?: string;
    readonly type: string;
  }[];
  readonly name: string;
}

export function decodeContractError(
  error: unknown,
  abis: readonly Abi[] = [],
): DecodedContractError | undefined {
  const data = findErrorData(error);
  return data ? decodeContractErrorData(data, abis) : undefined;
}

export function formatDecodedContractError(
  error: unknown,
  abis: readonly Abi[] = [],
): string | undefined {
  const decoded = decodeContractError(error, abis);
  if (!decoded) {
    return undefined;
  }

  return decoded.nested
    ? `${decoded.message}; nested error: ${decoded.nested.message}`
    : decoded.message;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const record = error as unknown as Record<string, unknown>;
    return typeof record.shortMessage === "string"
      ? record.shortMessage
      : error.message;
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

  return String(error || "Unknown transaction error.");
}

function decodeContractErrorData(
  data: Hex,
  abis: readonly Abi[],
): DecodedContractError | undefined {
  try {
    const decodeAbi = buildDecodeAbi(abis);
    const decoded = decodeErrorResult({
      abi: decodeAbi,
      data,
    });
    const abiItem = decoded.abiItem as AbiErrorItem;
    const args = Array.isArray(decoded.args) ? decoded.args : [];
    const name = decoded.errorName;
    const message = formatDecodedError(name, abiItem, args);
    const nested = decodeNestedError({ abiItem, args, abis });

    return { data, message, name, nested };
  } catch {
    return undefined;
  }
}

function decodeNestedError({
  abiItem,
  abis,
  args,
}: {
  readonly abiItem: AbiErrorItem;
  readonly abis: readonly Abi[];
  readonly args: readonly unknown[];
}): DecodedContractError | undefined {
  if (abiItem.name !== "ExecutionFailed") {
    return undefined;
  }

  const reason = args[0];
  return isHexErrorData(reason) ? decodeContractErrorData(reason, abis) : undefined;
}

function formatDecodedError(
  name: string,
  abiItem: AbiErrorItem,
  args: readonly unknown[],
): string {
  if (args.length === 0) {
    return `${name}()`;
  }

  const inputs = abiItem.inputs ?? [];
  const formattedArgs = args.map((arg, index) => {
    const inputName = inputs[index]?.name?.trim();
    return `${inputName || `arg${index}`}: ${formatValue(arg)}`;
  });

  return `${name}(${formattedArgs.join(", ")})`;
}

function formatValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(", ")}]`;
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    );
  }

  return String(value);
}

function buildDecodeAbi(abis: readonly Abi[]): Abi {
  return [
    ...STANDARD_SOLIDITY_ERROR_ABI,
    ...ISONIA_PROTOCOL_ERROR_ABI,
    ...abis.flat(),
  ] as Abi;
}

function findErrorData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): Hex | undefined {
  if (isHexErrorData(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match =
      /(?:revert data|error data|returned data|raw data|data:)\D*(0x[0-9a-fA-F]{8,})/i.exec(
        value,
      );
    return isHexErrorData(match?.[1]) ? match[1] : undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  const record = value as Record<string, unknown>;
  for (const key of ERROR_DATA_KEYS) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const data = findErrorData(item, seen);
        if (data) {
          return data;
        }
      }
      continue;
    }

    const data = findErrorData(nested, seen);
    if (data) {
      return data;
    }
  }

  return undefined;
}

function isHexErrorData(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{8,}$/.test(value);
}
