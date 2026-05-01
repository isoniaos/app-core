import type { Address } from "@isonia/types";
import { BODY_KIND_CHAIN_MAP, BodyKind } from "@isonia/types";
import {
  decodeEventLog,
  type Abi,
  type TransactionReceipt,
} from "viem";

export const GOV_CORE_ABI = [
  {
    type: "function",
    name: "createOrganization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "slug", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "admin", type: "address" },
    ],
    outputs: [{ name: "orgId", type: "uint64" }],
  },
  {
    type: "function",
    name: "createBody",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "kind", type: "uint8" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "bodyId", type: "uint64" }],
  },
  {
    type: "event",
    name: "OrganizationCreated",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "slug", type: "string", indexed: false },
      { name: "admin", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BodyCreated",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "bodyId", type: "uint64", indexed: true },
      { name: "kind", type: "uint8", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const satisfies Abi;

export interface OrganizationCreatedLog {
  readonly orgId: string;
  readonly slug: string;
  readonly adminAddress: Address;
  readonly metadataUri: string;
}

interface OrganizationCreatedArgs {
  readonly orgId: bigint;
  readonly slug: string;
  readonly admin: Address;
  readonly metadataURI: string;
}

export interface BodyCreatedLog {
  readonly bodyId: string;
  readonly kind: BodyKind;
  readonly metadataUri: string;
  readonly orgId: string;
}

interface BodyCreatedArgs {
  readonly bodyId: bigint;
  readonly kind: bigint | number;
  readonly metadataURI: string;
  readonly orgId: bigint;
}

export function parseOrganizationCreatedLog(
  receipt: TransactionReceipt,
  govCoreAddress: Address,
): OrganizationCreatedLog | undefined {
  const expectedAddress = govCoreAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== expectedAddress) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: GOV_CORE_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "OrganizationCreated") {
        continue;
      }

      const args = decoded.args as unknown as OrganizationCreatedArgs;
      return {
        adminAddress: args.admin,
        metadataUri: args.metadataURI,
        orgId: args.orgId.toString(),
        slug: args.slug,
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function parseBodyCreatedLog(
  receipt: TransactionReceipt,
  govCoreAddress: Address,
): BodyCreatedLog | undefined {
  const expectedAddress = govCoreAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== expectedAddress) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: GOV_CORE_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "BodyCreated") {
        continue;
      }

      const args = decoded.args as unknown as BodyCreatedArgs;
      const kind = getBodyKindFromChainCode(args.kind);
      if (!kind) {
        continue;
      }

      return {
        bodyId: args.bodyId.toString(),
        kind,
        metadataUri: args.metadataURI,
        orgId: args.orgId.toString(),
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function getBodyKindChainCode(kind: BodyKind): number | undefined {
  return BODY_KIND_TO_CHAIN_CODE[kind];
}

export function buildOrganizationSlug(fallbackName: string): string {
  const slug = fallbackName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organization";
}

function getBodyKindFromChainCode(value: bigint | number): BodyKind | undefined {
  const code = Number(value);
  return BODY_KIND_CHAIN_MAP.valuesByCode[
    code as keyof typeof BODY_KIND_CHAIN_MAP.valuesByCode
  ];
}

const BODY_KIND_TO_CHAIN_CODE: Readonly<Record<BodyKind, number>> = {
  [BodyKind.GeneralCouncil]: BODY_KIND_CHAIN_MAP.codes.GeneralCouncil,
  [BodyKind.TreasuryCommittee]: BODY_KIND_CHAIN_MAP.codes.TreasuryCommittee,
  [BodyKind.SecurityCouncil]: BODY_KIND_CHAIN_MAP.codes.SecurityCouncil,
  [BodyKind.CapitalHouse]: BODY_KIND_CHAIN_MAP.codes.CapitalHouse,
  [BodyKind.MeritHouse]: BODY_KIND_CHAIN_MAP.codes.MeritHouse,
  [BodyKind.EmergencyCouncil]: BODY_KIND_CHAIN_MAP.codes.EmergencyCouncil,
  [BodyKind.Custom]: BODY_KIND_CHAIN_MAP.codes.Custom,
};
