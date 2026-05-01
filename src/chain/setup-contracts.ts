import type { Address } from "@isonia/types";
import {
  BODY_KIND_CHAIN_MAP,
  BodyKind,
  PROPOSAL_TYPE_CHAIN_MAP,
  ProposalType,
  ROLE_TYPE_CHAIN_MAP,
  RoleType,
} from "@isonia/types";
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
    type: "function",
    name: "createRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "bodyId", type: "uint64" },
      { name: "roleType", type: "uint8" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "roleId", type: "uint64" }],
  },
  {
    type: "function",
    name: "assignMandate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "roleId", type: "uint64" },
      { name: "holder", type: "address" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
      { name: "proposalTypeMask", type: "uint256" },
      { name: "spendingLimit", type: "uint128" },
    ],
    outputs: [{ name: "mandateId", type: "uint64" }],
  },
  {
    type: "function",
    name: "setPolicyRule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "proposalType", type: "uint8" },
      { name: "requiredApprovalBodies", type: "uint64[]" },
      { name: "vetoBodies", type: "uint64[]" },
      { name: "executorBody", type: "uint64" },
      { name: "timelockSeconds", type: "uint64" },
      { name: "enabled", type: "bool" },
    ],
    outputs: [],
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
  {
    type: "event",
    name: "RoleCreated",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "roleId", type: "uint64", indexed: true },
      { name: "bodyId", type: "uint64", indexed: true },
      { name: "roleType", type: "uint8", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MandateAssigned",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "mandateId", type: "uint64", indexed: true },
      { name: "roleId", type: "uint64", indexed: true },
      { name: "bodyId", type: "uint64", indexed: false },
      { name: "holder", type: "address", indexed: false },
      { name: "startTime", type: "uint64", indexed: false },
      { name: "endTime", type: "uint64", indexed: false },
      { name: "proposalTypeMask", type: "uint256", indexed: false },
      { name: "spendingLimit", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyRuleSet",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "proposalType", type: "uint8", indexed: true },
      { name: "version", type: "uint64", indexed: false },
      { name: "requiredApprovalBodies", type: "uint64[]", indexed: false },
      { name: "vetoBodies", type: "uint64[]", indexed: false },
      { name: "executorBody", type: "uint64", indexed: false },
      { name: "timelockSeconds", type: "uint64", indexed: false },
      { name: "enabled", type: "bool", indexed: false },
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

export interface RoleCreatedLog {
  readonly bodyId: string;
  readonly metadataUri: string;
  readonly orgId: string;
  readonly roleId: string;
  readonly roleType: RoleType;
}

export interface MandateAssignedLog {
  readonly bodyId: string;
  readonly endTime: string;
  readonly holderAddress: Address;
  readonly mandateId: string;
  readonly orgId: string;
  readonly proposalTypeMask: string;
  readonly roleId: string;
  readonly spendingLimit: string;
  readonly startTime: string;
}

export interface PolicyRuleSetLog {
  readonly enabled: boolean;
  readonly executorBody: string;
  readonly orgId: string;
  readonly proposalType: ProposalType;
  readonly requiredApprovalBodies: readonly string[];
  readonly timelockSeconds: string;
  readonly vetoBodies: readonly string[];
  readonly version: string;
}

interface RoleCreatedArgs {
  readonly bodyId: bigint;
  readonly metadataURI: string;
  readonly orgId: bigint;
  readonly roleId: bigint;
  readonly roleType: bigint | number;
}

interface MandateAssignedArgs {
  readonly bodyId: bigint;
  readonly endTime: bigint;
  readonly holder: Address;
  readonly mandateId: bigint;
  readonly orgId: bigint;
  readonly proposalTypeMask: bigint;
  readonly roleId: bigint;
  readonly spendingLimit: bigint;
  readonly startTime: bigint;
}

interface PolicyRuleSetArgs {
  readonly enabled: boolean;
  readonly executorBody: bigint;
  readonly orgId: bigint;
  readonly proposalType: bigint | number;
  readonly requiredApprovalBodies: readonly bigint[];
  readonly timelockSeconds: bigint;
  readonly vetoBodies: readonly bigint[];
  readonly version: bigint;
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

export function parseRoleCreatedLog(
  receipt: TransactionReceipt,
  govCoreAddress: Address,
): RoleCreatedLog | undefined {
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

      if (decoded.eventName !== "RoleCreated") {
        continue;
      }

      const args = decoded.args as unknown as RoleCreatedArgs;
      const roleType = getRoleTypeFromChainCode(args.roleType);
      if (!roleType) {
        continue;
      }

      return {
        bodyId: args.bodyId.toString(),
        metadataUri: args.metadataURI,
        orgId: args.orgId.toString(),
        roleId: args.roleId.toString(),
        roleType,
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function parseMandateAssignedLog(
  receipt: TransactionReceipt,
  govCoreAddress: Address,
): MandateAssignedLog | undefined {
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

      if (decoded.eventName !== "MandateAssigned") {
        continue;
      }

      const args = decoded.args as unknown as MandateAssignedArgs;
      return {
        bodyId: args.bodyId.toString(),
        endTime: args.endTime.toString(),
        holderAddress: args.holder,
        mandateId: args.mandateId.toString(),
        orgId: args.orgId.toString(),
        proposalTypeMask: args.proposalTypeMask.toString(),
        roleId: args.roleId.toString(),
        spendingLimit: args.spendingLimit.toString(),
        startTime: args.startTime.toString(),
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function parsePolicyRuleSetLog(
  receipt: TransactionReceipt,
  govCoreAddress: Address,
): PolicyRuleSetLog | undefined {
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

      if (decoded.eventName !== "PolicyRuleSet") {
        continue;
      }

      const args = decoded.args as unknown as PolicyRuleSetArgs;
      const proposalType = getProposalTypeFromChainCode(args.proposalType);
      if (!proposalType) {
        continue;
      }

      return {
        enabled: args.enabled,
        executorBody: args.executorBody.toString(),
        orgId: args.orgId.toString(),
        proposalType,
        requiredApprovalBodies: args.requiredApprovalBodies.map((bodyId) =>
          bodyId.toString(),
        ),
        timelockSeconds: args.timelockSeconds.toString(),
        vetoBodies: args.vetoBodies.map((bodyId) => bodyId.toString()),
        version: args.version.toString(),
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

export function getProposalTypeChainCode(
  proposalType: ProposalType,
): number | undefined {
  return PROPOSAL_TYPE_TO_CHAIN_CODE[proposalType];
}

export function getRoleTypeChainCode(roleType: RoleType): number | undefined {
  return ROLE_TYPE_TO_CHAIN_CODE[roleType];
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

function getRoleTypeFromChainCode(value: bigint | number): RoleType | undefined {
  const code = Number(value);
  return ROLE_TYPE_CHAIN_MAP.valuesByCode[
    code as keyof typeof ROLE_TYPE_CHAIN_MAP.valuesByCode
  ];
}

function getProposalTypeFromChainCode(
  value: bigint | number,
): ProposalType | undefined {
  const code = Number(value);
  return PROPOSAL_TYPE_CHAIN_MAP.valuesByCode[
    code as keyof typeof PROPOSAL_TYPE_CHAIN_MAP.valuesByCode
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

const ROLE_TYPE_TO_CHAIN_CODE: Readonly<Record<RoleType, number>> = {
  [RoleType.OrgAdmin]: ROLE_TYPE_CHAIN_MAP.codes.OrgAdmin,
  [RoleType.BodyAdmin]: ROLE_TYPE_CHAIN_MAP.codes.BodyAdmin,
  [RoleType.Proposer]: ROLE_TYPE_CHAIN_MAP.codes.Proposer,
  [RoleType.Approver]: ROLE_TYPE_CHAIN_MAP.codes.Approver,
  [RoleType.Vetoer]: ROLE_TYPE_CHAIN_MAP.codes.Vetoer,
  [RoleType.Executor]: ROLE_TYPE_CHAIN_MAP.codes.Executor,
  [RoleType.EmergencyOperator]: ROLE_TYPE_CHAIN_MAP.codes.EmergencyOperator,
};

const PROPOSAL_TYPE_TO_CHAIN_CODE: Readonly<Record<ProposalType, number>> = {
  [ProposalType.Standard]: PROPOSAL_TYPE_CHAIN_MAP.codes.Standard,
  [ProposalType.Treasury]: PROPOSAL_TYPE_CHAIN_MAP.codes.Treasury,
  [ProposalType.Upgrade]: PROPOSAL_TYPE_CHAIN_MAP.codes.Upgrade,
  [ProposalType.Emergency]: PROPOSAL_TYPE_CHAIN_MAP.codes.Emergency,
};
