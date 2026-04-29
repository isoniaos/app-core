import type { Address, Bytes32Hash } from "@isonia/types";
import { PROPOSAL_TYPE_CHAIN_MAP, ProposalType } from "@isonia/types";
import {
  decodeEventLog,
  encodeFunctionData,
  keccak256,
  type Abi,
  type Hex,
  type TransactionReceipt,
} from "viem";

export const GOV_PROPOSALS_ABI = [
  {
    type: "function",
    name: "createProposal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "proposalType", type: "uint8" },
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "dataHash", type: "bytes32" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "proposalId", type: "uint64" }],
  },
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { name: "orgId", type: "uint64", indexed: true },
      { name: "proposalId", type: "uint64", indexed: true },
      { name: "proposalType", type: "uint8", indexed: true },
      { name: "policyVersion", type: "uint64", indexed: false },
      { name: "creator", type: "address", indexed: false },
      { name: "target", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "dataHash", type: "bytes32", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const satisfies Abi;

export const DEMO_TARGET_ABI = [
  {
    type: "function",
    name: "setNumber",
    stateMutability: "payable",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "newNumber", type: "uint256" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const CREATE_PROPOSAL_TYPES = [
  ProposalType.Standard,
  ProposalType.Treasury,
  ProposalType.Upgrade,
  ProposalType.Emergency,
] as const;

export interface DemoProposalAction {
  readonly actionData: Hex;
  readonly dataHash: Bytes32Hash;
}

export interface ProposalCreatedLog {
  readonly orgId: string;
  readonly proposalId: string;
  readonly policyVersion: string;
  readonly targetAddress: Address;
  readonly dataHash: Bytes32Hash;
}

interface ProposalCreatedArgs {
  readonly orgId: bigint;
  readonly proposalId: bigint;
  readonly policyVersion: bigint;
  readonly target: Address;
  readonly dataHash: Bytes32Hash;
}

export function proposalTypeToChainCode(proposalType: ProposalType): number {
  for (const [code, value] of Object.entries(
    PROPOSAL_TYPE_CHAIN_MAP.valuesByCode,
  )) {
    if (value === proposalType) {
      return Number(code);
    }
  }

  throw new Error(`Unsupported proposal type: ${proposalType}`);
}

export function buildDemoSetNumberAction(
  orgId: bigint,
  newNumber: bigint,
): DemoProposalAction {
  const actionData = encodeFunctionData({
    abi: DEMO_TARGET_ABI,
    functionName: "setNumber",
    args: [orgId, newNumber],
  });

  return {
    actionData,
    dataHash: keccak256(actionData),
  };
}

export function parseProposalCreatedLog(
  receipt: TransactionReceipt,
  govProposalsAddress: Address,
): ProposalCreatedLog | undefined {
  const expectedAddress = govProposalsAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== expectedAddress) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: GOV_PROPOSALS_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "ProposalCreated") {
        continue;
      }

      const args = decoded.args as unknown as ProposalCreatedArgs;
      return {
        orgId: args.orgId.toString(),
        proposalId: args.proposalId.toString(),
        policyVersion: args.policyVersion.toString(),
        targetAddress: args.target,
        dataHash: args.dataHash,
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function isBytes32Hash(value: string): value is Bytes32Hash {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}
