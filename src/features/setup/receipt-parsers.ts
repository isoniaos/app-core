import type { MandateAssignedLog, PolicyRuleSetLog } from "../../chain/setup-contracts";
import type { TransactionReceipt } from "viem";
import type {
  AssignMandatePayload,
  SetPolicyRulePayload,
} from "./setup-action-execution-types";
import { sameAddress, sameStringArray } from "./setup-action-execution-helpers";

export function assertSuccessfulReceipt(receipt: TransactionReceipt): void {
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

export function assertMandateMatchesPayload(
  assigned: MandateAssignedLog,
  payload: AssignMandatePayload,
): void {
  if (assigned.orgId !== payload.orgId) {
    throw new Error(
      `Transaction emitted mandate for org #${assigned.orgId}, but setup expected org #${payload.orgId}.`,
    );
  }

  if (assigned.roleId !== payload.roleId) {
    throw new Error(
      `Transaction emitted mandate for role #${assigned.roleId}, but setup expected role #${payload.roleId}.`,
    );
  }

  if (!sameAddress(assigned.holderAddress, payload.holderAddress)) {
    throw new Error(
      `Transaction emitted mandate holder ${assigned.holderAddress}, but setup expected ${payload.holderAddress}.`,
    );
  }

  if (assigned.startTime !== payload.startTime) {
    throw new Error(
      `Transaction emitted start time ${assigned.startTime}, but setup expected ${payload.startTime}.`,
    );
  }

  if (assigned.endTime !== payload.endTime) {
    throw new Error(
      `Transaction emitted end time ${assigned.endTime}, but setup expected ${payload.endTime}.`,
    );
  }

  if (assigned.proposalTypeMask !== payload.proposalTypeMask) {
    throw new Error(
      `Transaction emitted proposal type mask ${assigned.proposalTypeMask}, but setup expected ${payload.proposalTypeMask}.`,
    );
  }

  if (assigned.spendingLimit !== payload.spendingLimit) {
    throw new Error(
      `Transaction emitted spending limit ${assigned.spendingLimit}, but setup expected ${payload.spendingLimit}.`,
    );
  }
}

export function assertPolicyRuleMatchesPayload(
  policySet: PolicyRuleSetLog,
  payload: SetPolicyRulePayload,
): void {
  if (policySet.orgId !== payload.orgId) {
    throw new Error(
      `Transaction emitted policy for org #${policySet.orgId}, but setup expected org #${payload.orgId}.`,
    );
  }

  if (policySet.proposalType !== payload.proposalType) {
    throw new Error(
      `Transaction emitted policy type ${policySet.proposalType}, but setup expected ${payload.proposalType}.`,
    );
  }

  if (!sameStringArray(policySet.requiredApprovalBodies, payload.requiredApprovalBodyIds)) {
    throw new Error(
      "Transaction emitted required approval bodies that do not match the resolved draft bodyIds.",
    );
  }

  if (!sameStringArray(policySet.vetoBodies, payload.vetoBodyIds)) {
    throw new Error(
      "Transaction emitted veto bodies that do not match the resolved draft bodyIds.",
    );
  }

  if (policySet.executorBody !== payload.executorBodyId) {
    throw new Error(
      `Transaction emitted executor body #${policySet.executorBody}, but setup expected #${payload.executorBodyId}.`,
    );
  }

  if (policySet.timelockSeconds !== payload.timelockSeconds) {
    throw new Error(
      `Transaction emitted timelock ${policySet.timelockSeconds}, but setup expected ${payload.timelockSeconds}.`,
    );
  }

  if (policySet.enabled !== payload.enabled) {
    throw new Error(
      `Transaction emitted enabled=${String(policySet.enabled)}, but setup expected enabled=${String(payload.enabled)}.`,
    );
  }
}
