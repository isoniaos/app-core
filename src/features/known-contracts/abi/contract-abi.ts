import type { Address, Bytes32Hash } from "@isonia/types";
import {
  encodeFunctionData,
  isAddress,
  keccak256,
  type Abi,
  type AbiFunction,
  type Hex,
} from "viem";

export type ContractFunctionKind = "readable" | "writable";
export type ParameterSourceMode = "literal" | "readResult";

export interface ParsedContractAbi {
  readonly abi: Abi;
  readonly functions: readonly ParsedContractFunction[];
  readonly readableCount: number;
  readonly writableCount: number;
}

export interface ParsedContractFunction {
  readonly abiItem: AbiFunction;
  readonly displayLabel: string;
  readonly fullLabel: string;
  readonly kind: ContractFunctionKind;
  readonly name: string;
  readonly outputsLabel: string;
  readonly payable: boolean;
  readonly signature: string;
  readonly supportedInputs: boolean;
  readonly unsupportedInputTypes: readonly string[];
}

export interface AbiParameter {
  readonly name?: string;
  readonly type: string;
}

export interface ReadResultValue {
  readonly id: string;
  readonly functionLabel: string;
  readonly functionSignature: string;
  readonly outputIndex: number;
  readonly outputName?: string;
  readonly type: string;
  readonly value: unknown;
}

export interface ActionDataPreview {
  readonly actionData: Hex;
  readonly actionSelector: Hex;
  readonly dataHash: Bytes32Hash;
}

export function parseContractAbiJson(value: string): ParsedContractAbi | Error {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error: unknown) {
    return new Error(`ABI JSON is invalid: ${getErrorMessage(error)}`);
  }

  if (!Array.isArray(parsed)) {
    return new Error("ABI JSON must be a standard ABI array.");
  }

  const abi = parsed as Abi;
  const functions = getContractFunctions(abi);

  if (functions.length === 0) {
    return new Error("ABI must include at least one callable function entry.");
  }

  return {
    abi,
    functions,
    readableCount: functions.filter((item) => item.kind === "readable").length,
    writableCount: functions.filter((item) => item.kind === "writable").length,
  };
}

export function getContractFunctions(
  abi: Abi,
): readonly ParsedContractFunction[] {
  return abi
    .filter(isAbiFunction)
    .map((item) => {
      const inputs = getAbiInputs(item);
      const outputs = getAbiOutputs(item);
      const signature = buildFunctionSignature(item.name, inputs);
      const kind = isReadableStateMutability(item.stateMutability)
        ? "readable"
        : "writable";
      const unsupportedInputTypes = inputs
        .map((input) => input.type)
        .filter((type) => !isSupportedAbiInputType(type));
      const outputsLabel = formatOutputsLabel(outputs);
      const displayLabel = signature;

      return {
        abiItem: item,
        displayLabel,
        fullLabel:
          kind === "readable" && outputsLabel
            ? `${displayLabel} -> ${outputsLabel}`
            : displayLabel,
        kind,
        name: item.name,
        outputsLabel,
        payable: item.stateMutability === "payable",
        signature,
        supportedInputs: unsupportedInputTypes.length === 0,
        unsupportedInputTypes,
      };
    });
}

export function buildFunctionSignature(
  name: string,
  inputs: readonly AbiParameter[],
): string {
  return `${name}(${inputs.map((input) => input.type).join(",")})`;
}

export function getAbiInputs(
  item: Pick<AbiFunction, "inputs">,
): readonly AbiParameter[] {
  return item.inputs.map((input) => ({
    name: input.name,
    type: input.type,
  }));
}

export function getAbiOutputs(
  item: Pick<AbiFunction, "outputs">,
): readonly AbiParameter[] {
  return item.outputs.map((output) => ({
    name: output.name,
    type: output.type,
  }));
}

export function isSupportedAbiInputType(type: string): boolean {
  const normalized = normalizeAbiType(type);

  if (isArrayType(normalized) || normalized.startsWith("tuple")) {
    return false;
  }

  return (
    normalized === "address" ||
    normalized === "bool" ||
    normalized === "string" ||
    normalized === "bytes" ||
    normalized === "bytes32" ||
    isFixedBytesType(normalized) ||
    isIntegerType(normalized)
  );
}

export function coerceAbiLiteral(
  type: string,
  value: string,
): unknown | Error {
  const normalized = normalizeAbiType(type);
  const trimmed = value.trim();

  if (!isSupportedAbiInputType(normalized)) {
    return new Error(`${type} inputs are not supported in v1.`);
  }

  if (normalized === "address") {
    return isAddress(trimmed)
      ? (trimmed as Address)
      : new Error("Address must be a valid EVM address.");
  }

  if (normalized === "bool") {
    if (/^(true|1|yes)$/i.test(trimmed)) {
      return true;
    }
    if (/^(false|0|no)$/i.test(trimmed)) {
      return false;
    }
    return new Error("Boolean value must be true or false.");
  }

  if (normalized === "string") {
    return value;
  }

  if (
    normalized === "bytes" ||
    normalized === "bytes32" ||
    isFixedBytesType(normalized)
  ) {
    if (!isHex(trimmed)) {
      return new Error(`${type} value must be 0x-prefixed hex.`);
    }
    if (normalized !== "bytes") {
      const expectedBytes =
        normalized === "bytes32" ? 32 : Number(normalized.slice(5));
      const actualBytes = (trimmed.length - 2) / 2;
      if (actualBytes !== expectedBytes) {
        return new Error(`${type} value must be exactly ${expectedBytes} bytes.`);
      }
    }
    return trimmed as Hex;
  }

  if (isUnsignedIntegerType(normalized)) {
    if (!/^\d+$/.test(trimmed)) {
      return new Error(`${type} value must be a non-negative integer.`);
    }
    return parseBigInt(trimmed, type);
  }

  if (isSignedIntegerType(normalized)) {
    if (!/^-?\d+$/.test(trimmed)) {
      return new Error(`${type} value must be an integer.`);
    }
    return parseBigInt(trimmed, type);
  }

  return new Error(`${type} inputs are not supported in v1.`);
}

export function areAbiTypesCompatible(
  inputType: string,
  outputType: string,
): boolean {
  return normalizeAbiType(inputType) === normalizeAbiType(outputType);
}

export function getCompatibleReadResults(
  inputType: string,
  results: readonly ReadResultValue[],
): readonly ReadResultValue[] {
  return results.filter((result) =>
    areAbiTypesCompatible(inputType, result.type),
  );
}

export function buildActionDataPreview({
  args,
  fn,
}: {
  readonly args: readonly unknown[];
  readonly fn: ParsedContractFunction;
}): ActionDataPreview | Error {
  if (fn.kind !== "writable") {
    return new Error("Readable functions are not proposal actions in this flow.");
  }

  try {
    const actionData = encodeFunctionData({
      abi: [fn.abiItem] as Abi,
      args,
      functionName: fn.name,
    });

    return {
      actionData,
      actionSelector: actionData.slice(0, 10) as Hex,
      dataHash: keccak256(actionData),
    };
  } catch (error: unknown) {
    return new Error(`Unable to encode action data: ${getErrorMessage(error)}`);
  }
}

export function parseProposalActionValue(
  fn: Pick<ParsedContractFunction, "payable">,
  value: string,
): bigint | Error {
  if (!fn.payable) {
    return 0n;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return new Error("Value must be a non-negative wei integer.");
  }

  try {
    return BigInt(trimmed);
  } catch {
    return new Error("Value is too large.");
  }
}

export function formatReadResultValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map(formatReadResultValue).join(", ")}]`;
  }

  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  return JSON.stringify(value);
}

export function formatAbiParameterLabel(
  parameter: AbiParameter,
  index: number,
): string {
  const name = parameter.name?.trim();
  return name ? `${name} (${parameter.type})` : `#${index + 1} (${parameter.type})`;
}

function isAbiFunction(item: Abi[number]): item is AbiFunction {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    item.type === "function" &&
    "name" in item &&
    typeof item.name === "string" &&
    item.name.trim().length > 0
  );
}

function isReadableStateMutability(
  stateMutability: AbiFunction["stateMutability"],
): boolean {
  return stateMutability === "view" || stateMutability === "pure";
}

function formatOutputsLabel(outputs: readonly AbiParameter[]): string {
  if (outputs.length === 0) {
    return "";
  }

  return outputs
    .map((output, index) => {
      const name = output.name?.trim();
      return name ? `${name}:${output.type}` : `${index}:${output.type}`;
    })
    .join(", ");
}

function normalizeAbiType(type: string): string {
  if (type === "uint") {
    return "uint256";
  }

  if (type === "int") {
    return "int256";
  }

  return type.trim();
}

function isArrayType(type: string): boolean {
  return /\[[0-9]*\]$/.test(type);
}

function isIntegerType(type: string): boolean {
  return isUnsignedIntegerType(type) || isSignedIntegerType(type);
}

function isUnsignedIntegerType(type: string): boolean {
  return /^uint(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/.test(
    normalizeAbiType(type),
  );
}

function isSignedIntegerType(type: string): boolean {
  return /^int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/.test(
    normalizeAbiType(type),
  );
}

function isFixedBytesType(type: string): boolean {
  if (!/^bytes(?:[1-9]|[12][0-9]|3[0-2])$/.test(type)) {
    return false;
  }

  return type !== "bytes32";
}

function isHex(value: string): boolean {
  return /^0x(?:[0-9a-fA-F]{2})*$/.test(value);
}

function parseBigInt(value: string, type: string): bigint | Error {
  try {
    return BigInt(value);
  } catch {
    return new Error(`${type} value is too large.`);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
