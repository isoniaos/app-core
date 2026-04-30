import type { Address } from "@isonia/types";
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
    type: "event",
    name: "OrganizationCreated",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "slug", type: "string", indexed: false },
      { name: "admin", type: "address", indexed: true },
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

export function buildOrganizationSlug(fallbackName: string): string {
  const slug = fallbackName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organization";
}
