import type {
  Address,
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
} from "@isonia/types";
import { encodeFunctionData, isAddress } from "viem";
import {
  getBodyKindChainCode,
  getProposalTypeChainCode,
  getRoleTypeChainCode,
  GOV_CORE_ABI,
} from "../../chain/setup-contracts";
import type { PreparedContractCall } from "../../transactions/prepared-contract-call";
import {
  getPolicyMandateDependencies,
  getProposalTypeMask,
  isZeroAddress,
  parsePolicyBodyIdArray,
  parsePositiveUint64,
  parseUint128,
  parseUint256,
  parseUint64,
  resolveBodyReference,
  resolvePolicyBodyReferences,
} from "./setup-action-execution-helpers";
import type {
  AssignMandatePayload,
  CreateBodyPayload,
  CreateRolePayload,
  SetPolicyRulePayload,
} from "./setup-action-execution-types";

export interface PreparedSetupActionCall<TPayload> {
  readonly call: PreparedContractCall;
  readonly payload: TPayload;
}

export type PreparedActivationCall =
  | PreparedSetupActionCall<CreateBodyPayload>
  | PreparedSetupActionCall<CreateRolePayload>
  | PreparedSetupActionCall<AssignMandatePayload>
  | PreparedSetupActionCall<SetPolicyRulePayload>;

export function prepareCreateBodyCall({
  action,
  chainId,
  govCoreAddress,
  resolvedOrgId,
}: {
  readonly action: CreateBodySetupAction;
  readonly chainId: number;
  readonly govCoreAddress: Address;
  readonly resolvedOrgId: string;
}): PreparedSetupActionCall<CreateBodyPayload> | Error {
  const payload = buildCreateBodyPayload(action, resolvedOrgId);
  if (payload instanceof Error) {
    return payload;
  }

  return {
    call: {
      actionId: action.actionId,
      chainId,
      data: encodeFunctionData({
        abi: GOV_CORE_ABI,
        args: buildCreateBodyCallArgs(payload),
        functionName: "createBody",
      }),
      title: action.label,
      to: govCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function prepareCreateRoleCall({
  action,
  bodyActions,
  chainId,
  govCoreAddress,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly action: CreateRoleSetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly chainId: number;
  readonly govCoreAddress: Address;
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string;
}): PreparedSetupActionCall<CreateRolePayload> | Error {
  const resolvedBodyId = resolveBodyReference({
    bodyActions,
    reference: action.bodyRef,
    resolvedBodyIds,
  });
  if (!resolvedBodyId) {
    return new Error(
      "Create role is blocked until the referenced body is indexed and the real bodyId is resolved.",
    );
  }

  const payload = buildCreateRolePayload(action, resolvedOrgId, resolvedBodyId);
  if (payload instanceof Error) {
    return payload;
  }

  return {
    call: {
      actionId: action.actionId,
      chainId,
      data: encodeFunctionData({
        abi: GOV_CORE_ABI,
        args: buildCreateRoleCallArgs(payload),
        functionName: "createRole",
      }),
      title: action.label,
      to: govCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function prepareAssignMandateCall({
  action,
  chainId,
  govCoreAddress,
  resolvedOrgId,
  resolvedRoleId,
}: {
  readonly action: AssignMandateSetupAction;
  readonly chainId: number;
  readonly govCoreAddress: Address;
  readonly resolvedOrgId: string;
  readonly resolvedRoleId: string;
}): PreparedSetupActionCall<AssignMandatePayload> | Error {
  const payload = buildAssignMandatePayload(
    action,
    resolvedOrgId,
    resolvedRoleId,
  );
  if (payload instanceof Error) {
    return payload;
  }

  return {
    call: {
      actionId: action.actionId,
      chainId,
      data: encodeFunctionData({
        abi: GOV_CORE_ABI,
        args: buildAssignMandateCallArgs(payload),
        functionName: "assignMandate",
      }),
      title: action.label,
      to: govCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function prepareSetPolicyRuleCall({
  action,
  bodyActions,
  chainId,
  govCoreAddress,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly action: SetPolicyRuleSetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly chainId: number;
  readonly govCoreAddress: Address;
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string;
}): PreparedSetupActionCall<SetPolicyRulePayload> | Error {
  const payload = buildSetPolicyRulePayload({
    action,
    bodyActions,
    resolvedBodyIds,
    resolvedOrgId,
  });
  if (payload instanceof Error) {
    return payload;
  }

  return {
    call: {
      actionId: action.actionId,
      chainId,
      data: encodeFunctionData({
        abi: GOV_CORE_ABI,
        args: buildSetPolicyRuleCallArgs(payload),
        functionName: "setPolicyRule",
      }),
      title: action.label,
      to: govCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function buildCreateBodyCallArgs(
  payload: CreateBodyPayload,
): readonly [bigint, number, string] {
  return [payload.orgIdBigInt, payload.bodyKindCode, payload.metadataUri];
}

export function buildCreateRoleCallArgs(
  payload: CreateRolePayload,
): readonly [bigint, bigint, number, string] {
  return [
    payload.orgIdBigInt,
    payload.bodyIdBigInt,
    payload.roleTypeCode,
    payload.metadataUri,
  ];
}

export function buildAssignMandateCallArgs(
  payload: AssignMandatePayload,
): readonly [bigint, bigint, Address, bigint, bigint, bigint, bigint] {
  return [
    payload.orgIdBigInt,
    payload.roleIdBigInt,
    payload.holderAddress,
    payload.startTimeBigInt,
    payload.endTimeBigInt,
    payload.proposalTypeMaskBigInt,
    payload.spendingLimitBigInt,
  ];
}

export function buildSetPolicyRuleCallArgs(
  payload: SetPolicyRulePayload,
): readonly [
  bigint,
  number,
  readonly bigint[],
  readonly bigint[],
  bigint,
  bigint,
  boolean,
] {
  return [
    payload.orgIdBigInt,
    payload.proposalTypeCode,
    payload.requiredApprovalBodyIdsBigInt,
    payload.vetoBodyIdsBigInt,
    payload.executorBodyIdBigInt,
    payload.timelockSecondsBigInt,
    payload.enabled,
  ];
}

export function buildCreateBodyPayload(
  action: CreateBodySetupAction,
  resolvedOrgId: string,
): CreateBodyPayload | Error {
  if (!action.active) {
    return new Error(
      "GovCore createBody creates active bodies only; inactive body drafts are not executable.",
    );
  }

  const bodyKindCode = getBodyKindChainCode(action.bodyKind);
  if (bodyKindCode === undefined) {
    return new Error(`Unsupported body kind: ${action.bodyKind}.`);
  }

  const orgIdBigInt = parsePositiveUint64(resolvedOrgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  return {
    bodyKindCode,
    metadataUri: action.metadataUri ?? "",
    orgId: resolvedOrgId,
    orgIdBigInt,
  };
}

export function buildCreateRolePayload(
  action: CreateRoleSetupAction,
  resolvedOrgId: string,
  resolvedBodyId: string,
): CreateRolePayload | Error {
  if (!action.active) {
    return new Error(
      "GovCore createRole creates active roles only; inactive role drafts are not executable.",
    );
  }

  const roleTypeCode = getRoleTypeChainCode(action.roleType);
  if (roleTypeCode === undefined) {
    return new Error(`Unsupported role type: ${action.roleType}.`);
  }

  const orgIdBigInt = parsePositiveUint64(resolvedOrgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const bodyIdBigInt = parsePositiveUint64(resolvedBodyId, "Resolved bodyId");
  if (bodyIdBigInt instanceof Error) {
    return bodyIdBigInt;
  }

  return {
    bodyId: resolvedBodyId,
    bodyIdBigInt,
    metadataUri: action.metadataUri ?? "",
    orgId: resolvedOrgId,
    orgIdBigInt,
    roleTypeCode,
  };
}

export function buildAssignMandatePayload(
  action: AssignMandateSetupAction,
  resolvedOrgId: string,
  resolvedRoleId: string,
): AssignMandatePayload | Error {
  if (!isAddress(action.holderAddress) || isZeroAddress(action.holderAddress)) {
    return new Error("Mandate holder address must be a non-zero EVM address.");
  }

  const orgIdBigInt = parsePositiveUint64(resolvedOrgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const roleIdBigInt = parsePositiveUint64(resolvedRoleId, "Resolved roleId");
  if (roleIdBigInt instanceof Error) {
    return roleIdBigInt;
  }

  const startTimeBigInt = parseUint64(action.startTime, "Mandate start time");
  if (startTimeBigInt instanceof Error) {
    return startTimeBigInt;
  }

  const endTimeBigInt = parseUint64(action.endTime, "Mandate end time");
  if (endTimeBigInt instanceof Error) {
    return endTimeBigInt;
  }

  if (endTimeBigInt !== 0n && endTimeBigInt <= startTimeBigInt) {
    return new Error(
      "Mandate end time must be zero or greater than the start time.",
    );
  }

  const proposalTypeMaskBigInt = parseUint256(
    action.proposalTypeMask,
    "Mandate proposal type mask",
  );
  if (proposalTypeMaskBigInt instanceof Error) {
    return proposalTypeMaskBigInt;
  }

  if (proposalTypeMaskBigInt === 0n) {
    return new Error(
      "Mandate proposal type mask must cover at least one proposal type.",
    );
  }

  if (action.proposalTypes) {
    const expectedMask = getProposalTypeMask(action.proposalTypes);
    if (proposalTypeMaskBigInt !== expectedMask) {
      return new Error(
        `Mandate proposal type mask ${proposalTypeMaskBigInt.toString()} does not match the selected proposal type scope ${expectedMask.toString()}.`,
      );
    }
  }

  const spendingLimitBigInt = parseUint128(
    action.spendingLimit,
    "Mandate spending limit",
  );
  if (spendingLimitBigInt instanceof Error) {
    return spendingLimitBigInt;
  }

  return {
    endTime: endTimeBigInt.toString(),
    endTimeBigInt,
    holderAddress: action.holderAddress,
    orgId: resolvedOrgId,
    orgIdBigInt,
    proposalTypeMask: proposalTypeMaskBigInt.toString(),
    proposalTypeMaskBigInt,
    roleId: resolvedRoleId,
    roleIdBigInt,
    spendingLimit: spendingLimitBigInt.toString(),
    spendingLimitBigInt,
    startTime: startTimeBigInt.toString(),
    startTimeBigInt,
  };
}

export function assertPolicyDependenciesResolved({
  action,
  mandateActions,
  resolvedMandateIds,
  roleActions,
}: {
  readonly action: SetPolicyRuleSetupAction;
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly resolvedMandateIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): Error | undefined {
  const unresolvedMandates = getPolicyMandateDependencies({
    mandateActions,
    policy: action,
    roleActions,
  }).filter((mandate) => !resolvedMandateIds[mandate.actionId]);

  return unresolvedMandates.length > 0
    ? new Error(
        `Set policy rule is blocked until ${unresolvedMandates.length.toLocaleString()} related mandate action${unresolvedMandates.length === 1 ? "" : "s"} are indexed.`,
      )
    : undefined;
}

export function buildSetPolicyRulePayload({
  action,
  bodyActions,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly action: SetPolicyRuleSetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string;
}): SetPolicyRulePayload | Error {
  if (action.warnings.some((warning) => warning.severity === "error")) {
    return new Error(
      "Resolve this policy action's validation errors before submitting.",
    );
  }

  if (typeof action.enabled !== "boolean") {
    return new Error("Policy enabled state must be a boolean before submission.");
  }

  const orgIdBigInt = parsePositiveUint64(resolvedOrgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const proposalTypeCode = getProposalTypeChainCode(action.proposalType);
  if (proposalTypeCode === undefined) {
    return new Error(`Unsupported proposal type: ${action.proposalType}.`);
  }

  const requiredApprovalBodyIds = resolvePolicyBodyReferences({
    bodyActions,
    label: "required approval body",
    references: action.requiredApprovalBodies,
    resolvedBodyIds,
  });
  if (requiredApprovalBodyIds instanceof Error) {
    return requiredApprovalBodyIds;
  }

  const vetoBodyIds = resolvePolicyBodyReferences({
    bodyActions,
    label: "veto body",
    references: action.vetoBodies,
    resolvedBodyIds,
  });
  if (vetoBodyIds instanceof Error) {
    return vetoBodyIds;
  }

  const executorBodyId = action.executorBody
    ? resolveBodyReference({
        bodyActions,
        reference: action.executorBody,
        resolvedBodyIds,
      })
    : undefined;
  if (action.executorBody && !executorBodyId) {
    return new Error(
      "Set policy rule is blocked until the executor body action resolves to a real bodyId.",
    );
  }
  if (action.enabled && !executorBodyId) {
    return new Error(
      "Enabled policy rules require a resolved executor body before submission.",
    );
  }

  const requiredApprovalBodyIdsBigInt = parsePolicyBodyIdArray(
    requiredApprovalBodyIds,
    "Required approval bodyId",
  );
  if (requiredApprovalBodyIdsBigInt instanceof Error) {
    return requiredApprovalBodyIdsBigInt;
  }

  const vetoBodyIdsBigInt = parsePolicyBodyIdArray(
    vetoBodyIds,
    "Veto bodyId",
  );
  if (vetoBodyIdsBigInt instanceof Error) {
    return vetoBodyIdsBigInt;
  }

  const executorBodyIdBigInt = executorBodyId
    ? parsePositiveUint64(executorBodyId, "Executor bodyId")
    : 0n;
  if (executorBodyIdBigInt instanceof Error) {
    return executorBodyIdBigInt;
  }

  const timelockSecondsBigInt = parseUint64(
    action.timelockSeconds,
    "Policy timelock seconds",
  );
  if (timelockSecondsBigInt instanceof Error) {
    return timelockSecondsBigInt;
  }

  return {
    enabled: action.enabled,
    executorBodyId: executorBodyId ?? "0",
    executorBodyIdBigInt,
    orgId: resolvedOrgId,
    orgIdBigInt,
    proposalType: action.proposalType,
    proposalTypeCode,
    requiredApprovalBodyIds,
    requiredApprovalBodyIdsBigInt,
    timelockSeconds: timelockSecondsBigInt.toString(),
    timelockSecondsBigInt,
    vetoBodyIds,
    vetoBodyIdsBigInt,
  };
}
