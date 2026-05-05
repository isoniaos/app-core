import type { Address } from "@isonia/types";
import { getAddress, isAddress } from "viem";

export type AddressValidationStatus =
  | "empty"
  | "valid"
  | "invalid_format"
  | "invalid_checksum"
  | "zero_address";

export type AddressStateTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export interface AddressValidationOptions {
  readonly allowZeroAddress?: boolean;
  readonly required?: boolean;
}

export interface AddressValidationResult {
  readonly input: string;
  readonly status: AddressValidationStatus;
  readonly isValid: boolean;
  readonly normalizedAddress?: Address;
  readonly message: string;
  readonly tone: AddressStateTone;
}

export interface ShortenAddressOptions {
  readonly leadingCharacters?: number;
  readonly trailingCharacters?: number;
}

export interface ParsedAddressListItem {
  readonly index: number;
  readonly rawInput: string;
  readonly validation: AddressValidationResult;
  readonly normalizedAddress?: Address;
  readonly isDuplicate: boolean;
  readonly duplicateOf?: number;
}

export interface DeduplicateAddressItemsOptions {
  readonly removeDuplicates?: boolean;
}

export interface DeduplicatedAddressItems {
  readonly items: readonly ParsedAddressListItem[];
  readonly duplicateCount: number;
  readonly removedDuplicateCount: number;
  readonly normalizedAddresses: readonly Address[];
}

const ADDRESS_PREFIX_PATTERN = /^0x/i;
const ADDRESS_BODY_PATTERN = /^[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS_PATTERN = /^0x0{40}$/i;

export function normalizeAddressInput(
  value: string,
  options: AddressValidationOptions = {},
): Address | undefined {
  return validateAddressInput(value, options).normalizedAddress;
}

export function shortenAddress(
  value: string,
  options: ShortenAddressOptions = {},
): string {
  const leadingCharacters = options.leadingCharacters ?? 6;
  const trailingCharacters = options.trailingCharacters ?? 4;
  const trimmed = value.trim();
  const visibleCharacters = leadingCharacters + trailingCharacters + 1;

  if (trimmed.length <= visibleCharacters) {
    return trimmed;
  }

  return `${trimmed.slice(0, leadingCharacters)}…${trimmed.slice(
    -trailingCharacters,
  )}`;
}

export function parseAddressListInput(
  value: string | readonly string[],
  options: AddressValidationOptions = {},
): readonly ParsedAddressListItem[] {
  const source = typeof value === "string" ? value : value.join("\n");

  return source
    .split(/[\n\r,;\t ]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((rawInput, index) => {
      const validation = validateAddressInput(rawInput, options);

      return {
        duplicateOf: undefined,
        index,
        isDuplicate: false,
        normalizedAddress: validation.normalizedAddress,
        rawInput,
        validation,
      };
    });
}

export function validateAddressInput(
  value: string,
  options: AddressValidationOptions = {},
): AddressValidationResult {
  const input = value.trim();

  if (input.length === 0) {
    return validationResult({
      input,
      message: options.required ? "Address is required." : "Enter an address.",
      status: "empty",
    });
  }

  if (!ADDRESS_PREFIX_PATTERN.test(input)) {
    return validationResult({
      input,
      message: "Use a 0x-prefixed 20-byte address.",
      status: "invalid_format",
    });
  }

  const body = input.slice(2);
  const address = `0x${body}`;

  if (!ADDRESS_BODY_PATTERN.test(body)) {
    return validationResult({
      input,
      message: "Address must contain exactly 40 hexadecimal characters.",
      status: "invalid_format",
    });
  }

  if (!options.allowZeroAddress && ZERO_ADDRESS_PATTERN.test(address)) {
    return validationResult({
      input,
      message: "Zero address is not allowed here.",
      status: "zero_address",
    });
  }

  const hasLowerHexLetter = /[a-f]/.test(body);
  const hasUpperHexLetter = /[A-F]/.test(body);

  if (hasLowerHexLetter && hasUpperHexLetter && !isAddress(address)) {
    return validationResult({
      input,
      message: "Mixed-case address checksum does not match.",
      status: "invalid_checksum",
    });
  }

  const checksumInput =
    hasLowerHexLetter && hasUpperHexLetter
      ? address
      : `0x${body.toLowerCase()}`;

  return validationResult({
    input,
    message: "Valid address.",
    normalizedAddress: getAddress(checksumInput) as Address,
    status: "valid",
  });
}

export function deduplicateAddressItems(
  items: readonly ParsedAddressListItem[],
  options: DeduplicateAddressItemsOptions = {},
): DeduplicatedAddressItems {
  const removeDuplicates = options.removeDuplicates ?? true;
  const seenAddresses = new Map<string, number>();
  const deduplicatedItems: ParsedAddressListItem[] = [];
  const normalizedAddresses: Address[] = [];
  let duplicateCount = 0;
  let removedDuplicateCount = 0;

  for (const item of items) {
    const normalizedAddress = item.validation.normalizedAddress;

    if (!normalizedAddress) {
      deduplicatedItems.push(item);
      continue;
    }

    const normalizedKey = normalizedAddress.toLowerCase();
    const duplicateOf = seenAddresses.get(normalizedKey);

    if (duplicateOf !== undefined) {
      duplicateCount += 1;

      if (removeDuplicates) {
        removedDuplicateCount += 1;
        continue;
      }

      deduplicatedItems.push({
        ...item,
        duplicateOf,
        isDuplicate: true,
      });
      continue;
    }

    seenAddresses.set(normalizedKey, item.index);
    normalizedAddresses.push(normalizedAddress);
    deduplicatedItems.push(item);
  }

  return {
    duplicateCount,
    items: deduplicatedItems,
    normalizedAddresses,
    removedDuplicateCount,
  };
}

export function getAddressValidationTone(
  status: AddressValidationStatus,
): AddressStateTone {
  switch (status) {
    case "valid":
      return "success";
    case "invalid_checksum":
    case "zero_address":
      return "danger";
    case "invalid_format":
      return "warning";
    case "empty":
      return "neutral";
  }
}

function validationResult({
  input,
  message,
  normalizedAddress,
  status,
}: {
  readonly input: string;
  readonly message: string;
  readonly normalizedAddress?: Address;
  readonly status: AddressValidationStatus;
}): AddressValidationResult {
  return {
    input,
    isValid: status === "valid",
    message,
    normalizedAddress,
    status,
    tone: getAddressValidationTone(status),
  };
}
