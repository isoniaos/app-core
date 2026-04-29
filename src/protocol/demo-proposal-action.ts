import type { ProposalDto } from "@isonia/types";
import type { Hex } from "viem";
import { buildDemoSetNumberAction } from "../chain/proposal-contracts";

export interface DemoExecutionState {
  readonly actionData?: Hex;
  readonly dataHash?: string;
  readonly message: string;
  readonly ready: boolean;
  readonly value?: bigint;
}

export function buildDemoExecution({
  demoNumber,
  demoTargetAddress,
  proposal,
}: {
  readonly demoNumber: string;
  readonly demoTargetAddress: string | undefined;
  readonly proposal: ProposalDto;
}): DemoExecutionState {
  if (!demoTargetAddress) {
    return {
      ready: false,
      message: "DemoTarget address is missing from runtime config.",
    };
  }

  if (!sameAddress(proposal.targetAddress, demoTargetAddress)) {
    return {
      ready: false,
      message: "Only proposals targeting the configured DemoTarget can execute here.",
    };
  }

  if (!proposal.dataHash) {
    return {
      ready: false,
      message: "Proposal data hash is missing from the read model.",
    };
  }

  const orgId = parseUint(proposal.orgId, "Organization ID");
  if (orgId instanceof Error) {
    return { ready: false, message: orgId.message };
  }

  const parsedDemoNumber = parseUint(demoNumber.trim(), "Demo number");
  if (parsedDemoNumber instanceof Error) {
    return { ready: false, message: parsedDemoNumber.message };
  }

  const value = parseUint(proposal.value, "Proposal value");
  if (value instanceof Error) {
    return { ready: false, message: value.message };
  }

  const action = buildDemoSetNumberAction(orgId, parsedDemoNumber);
  if (action.dataHash.toLowerCase() !== proposal.dataHash.toLowerCase()) {
    return {
      dataHash: action.dataHash,
      ready: false,
      message: "Generated DemoTarget.setNumber hash does not match the proposal data hash.",
    };
  }

  return {
    actionData: action.actionData,
    dataHash: action.dataHash,
    message: "Generated DemoTarget.setNumber action matches this proposal.",
    ready: true,
    value,
  };
}

export function inferDemoNumber({
  proposal,
  textHints,
}: {
  readonly proposal: ProposalDto;
  readonly textHints: readonly (string | undefined)[];
}): string | undefined {
  if (!proposal.dataHash) {
    return undefined;
  }

  const orgId = parseUint(proposal.orgId, "Organization ID");
  if (orgId instanceof Error) {
    return undefined;
  }

  const candidates = uniqueStrings(
    textHints.flatMap((value) => extractNumbers(value)),
  );

  return candidates.find((candidate) => {
    const parsed = parseUint(candidate, "Demo number");
    if (parsed instanceof Error) {
      return false;
    }
    return (
      buildDemoSetNumberAction(orgId, parsed).dataHash.toLowerCase() ===
      proposal.dataHash?.toLowerCase()
    );
  });
}

function extractNumbers(value: string | undefined): string[] {
  return value?.match(/\d+/g) ?? [];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sameAddress(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function parseUint(value: string, label: string): bigint | Error {
  if (!/^\d+$/.test(value)) {
    return new Error(`${label} must be a non-negative integer.`);
  }

  try {
    return BigInt(value);
  } catch {
    return new Error(`${label} is too large.`);
  }
}
