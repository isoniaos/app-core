import type {
  Address,
  AssignMandateSetupAction,
  BatchAssignMandatesInput,
  BatchCreateBodiesInput,
  BatchCreateRolesInput,
  BatchSetPolicyRulesInput,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
} from "@isonia/types";
import { encodeFunctionData, isAddress } from "viem";
import {
  getBodyKindChainCode,
  getProposalTypeChainCode,
  getRoleTypeChainCode,
  ISO_CORE_ABI,
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
  resolveRoleReference,
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

interface ContractBatchBodyCreateInput {
  readonly kind: number;
  readonly metadataURI: string;
}

interface ContractBatchRoleCreateInput {
  readonly bodyId: bigint;
  readonly roleType: number;
  readonly metadataURI: string;
}

interface ContractBatchMandateAssignInput {
  readonly roleId: bigint;
  readonly holder: Address;
  readonly startTime: bigint;
  readonly endTime: bigint;
  readonly proposalTypeMask: bigint;
  readonly spendingLimit: bigint;
}

interface ContractBatchPolicyRuleSetInput {
  readonly proposalType: number;
  readonly requiredApprovalBodies: readonly bigint[];
  readonly vetoBodies: readonly bigint[];
  readonly executorBody: bigint;
  readonly timelockSeconds: bigint;
  readonly enabled: boolean;
}

export type BatchCreateBodiesCallArgs = readonly [
  bigint,
  readonly ContractBatchBodyCreateInput[],
];

export type BatchCreateRolesCallArgs = readonly [
  bigint,
  readonly ContractBatchRoleCreateInput[],
];

export type BatchAssignMandatesCallArgs = readonly [
  bigint,
  readonly ContractBatchMandateAssignInput[],
];

export type BatchSetPolicyRulesCallArgs = readonly [
  bigint,
  readonly ContractBatchPolicyRuleSetInput[],
];

export function prepareCreateBodyCall({
  action,
  chainId,
  isoCoreAddress,
  resolvedOrgId,
}: {
  readonly action: CreateBodySetupAction;
  readonly chainId: number;
  readonly isoCoreAddress: Address;
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
        abi: ISO_CORE_ABI,
        args: buildCreateBodyCallArgs(payload),
        functionName: "createBody",
      }),
      title: action.label,
      to: isoCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function prepareCreateRoleCall({
  action,
  bodyActions,
  chainId,
  isoCoreAddress,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly action: CreateRoleSetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly chainId: number;
  readonly isoCoreAddress: Address;
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
        abi: ISO_CORE_ABI,
        args: buildCreateRoleCallArgs(payload),
        functionName: "createRole",
      }),
      title: action.label,
      to: isoCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function prepareAssignMandateCall({
  action,
  chainId,
  isoCoreAddress,
  resolvedOrgId,
  resolvedRoleId,
}: {
  readonly action: AssignMandateSetupAction;
  readonly chainId: number;
  readonly isoCoreAddress: Address;
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
        abi: ISO_CORE_ABI,
        args: buildAssignMandateCallArgs(payload),
        functionName: "assignMandate",
      }),
      title: action.label,
      to: isoCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function prepareSetPolicyRuleCall({
  action,
  bodyActions,
  chainId,
  isoCoreAddress,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly action: SetPolicyRuleSetupAction;
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly chainId: number;
  readonly isoCoreAddress: Address;
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
        abi: ISO_CORE_ABI,
        args: buildSetPolicyRuleCallArgs(payload),
        functionName: "setPolicyRule",
      }),
      title: action.label,
      to: isoCoreAddress,
      value: "0x0",
    },
    payload,
  };
}

export function buildBatchCreateBodiesInput({
  actions,
  resolvedOrgId,
}: {
  readonly actions: readonly CreateBodySetupAction[];
  readonly resolvedOrgId: string;
}): BatchCreateBodiesInput | Error {
  const inputs: BatchCreateBodiesInput["inputs"][number][] = [];

  for (const action of actions) {
    const payload = buildCreateBodyPayload(action, resolvedOrgId);
    if (payload instanceof Error) {
      return payload;
    }
    inputs.push({
      kind: action.bodyKind,
      metadataURI: payload.metadataUri,
    });
  }

  return { orgId: resolvedOrgId, inputs };
}

export function buildBatchCreateRolesInput({
  actions,
  bodyActions,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly actions: readonly CreateRoleSetupAction[];
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string;
}): BatchCreateRolesInput | Error {
  const inputs: BatchCreateRolesInput["inputs"][number][] = [];

  for (const action of actions) {
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

    const payload = buildCreateRolePayload(
      action,
      resolvedOrgId,
      resolvedBodyId,
    );
    if (payload instanceof Error) {
      return payload;
    }
    inputs.push({
      bodyId: payload.bodyId,
      metadataURI: payload.metadataUri,
      roleType: action.roleType,
    });
  }

  return { orgId: resolvedOrgId, inputs };
}

export function buildBatchAssignMandatesInput({
  actions,
  resolvedOrgId,
  resolvedRoleIds,
  roleActions,
}: {
  readonly actions: readonly AssignMandateSetupAction[];
  readonly resolvedOrgId: string;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): BatchAssignMandatesInput | Error {
  const inputs: BatchAssignMandatesInput["inputs"][number][] = [];

  for (const action of actions) {
    const resolvedRoleId = resolveRoleReference({
      reference: action.roleRef,
      resolvedRoleIds,
      roleActions,
    });
    if (!resolvedRoleId) {
      return new Error(
        "Assign mandate is blocked until the referenced role is indexed and the real roleId is resolved.",
      );
    }

    const payload = buildAssignMandatePayload(
      action,
      resolvedOrgId,
      resolvedRoleId,
    );
    if (payload instanceof Error) {
      return payload;
    }
    inputs.push({
      endTime: payload.endTime,
      holder: payload.holderAddress,
      proposalTypeMask: payload.proposalTypeMask,
      roleId: payload.roleId,
      spendingLimit: payload.spendingLimit,
      startTime: payload.startTime,
    });
  }

  return { orgId: resolvedOrgId, inputs };
}

export function buildBatchSetPolicyRulesInput({
  actions,
  bodyActions,
  resolvedBodyIds,
  resolvedOrgId,
}: {
  readonly actions: readonly SetPolicyRuleSetupAction[];
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string;
}): BatchSetPolicyRulesInput | Error {
  const inputs: BatchSetPolicyRulesInput["inputs"][number][] = [];

  for (const action of actions) {
    const payload = buildSetPolicyRulePayload({
      action,
      bodyActions,
      resolvedBodyIds,
      resolvedOrgId,
    });
    if (payload instanceof Error) {
      return payload;
    }
    inputs.push({
      enabled: payload.enabled,
      executorBody: payload.executorBodyId,
      proposalType: payload.proposalType,
      requiredApprovalBodies: payload.requiredApprovalBodyIds,
      timelockSeconds: payload.timelockSeconds,
      vetoBodies: payload.vetoBodyIds,
    });
  }

  return { orgId: resolvedOrgId, inputs };
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

export function buildBatchCreateBodiesCallArgs(
  batch: BatchCreateBodiesInput,
): BatchCreateBodiesCallArgs | Error {
  const orgIdBigInt = parsePositiveUint64(batch.orgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const inputs: ContractBatchBodyCreateInput[] = [];
  for (const input of batch.inputs) {
    const bodyKindCode = getBodyKindChainCode(input.kind);
    if (bodyKindCode === undefined) {
      return new Error(`Unsupported body kind: ${input.kind}.`);
    }
    inputs.push({
      kind: bodyKindCode,
      metadataURI: input.metadataURI,
    });
  }

  return [orgIdBigInt, inputs];
}

export function buildBatchCreateRolesCallArgs(
  batch: BatchCreateRolesInput,
): BatchCreateRolesCallArgs | Error {
  const orgIdBigInt = parsePositiveUint64(batch.orgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const inputs: ContractBatchRoleCreateInput[] = [];
  for (const input of batch.inputs) {
    const bodyIdBigInt = parsePositiveUint64(input.bodyId, "Resolved bodyId");
    if (bodyIdBigInt instanceof Error) {
      return bodyIdBigInt;
    }
    const roleTypeCode = getRoleTypeChainCode(input.roleType);
    if (roleTypeCode === undefined) {
      return new Error(`Unsupported role type: ${input.roleType}.`);
    }
    inputs.push({
      bodyId: bodyIdBigInt,
      metadataURI: input.metadataURI,
      roleType: roleTypeCode,
    });
  }

  return [orgIdBigInt, inputs];
}

export function buildBatchAssignMandatesCallArgs(
  batch: BatchAssignMandatesInput,
): BatchAssignMandatesCallArgs | Error {
  const orgIdBigInt = parsePositiveUint64(batch.orgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const inputs: ContractBatchMandateAssignInput[] = [];
  for (const input of batch.inputs) {
    const roleIdBigInt = parsePositiveUint64(input.roleId, "Resolved roleId");
    if (roleIdBigInt instanceof Error) {
      return roleIdBigInt;
    }
    const startTimeBigInt = parseUint64(input.startTime, "Mandate start time");
    if (startTimeBigInt instanceof Error) {
      return startTimeBigInt;
    }
    const endTimeBigInt = parseUint64(input.endTime, "Mandate end time");
    if (endTimeBigInt instanceof Error) {
      return endTimeBigInt;
    }
    const proposalTypeMaskBigInt = parseUint256(
      input.proposalTypeMask,
      "Mandate proposal type mask",
    );
    if (proposalTypeMaskBigInt instanceof Error) {
      return proposalTypeMaskBigInt;
    }
    const spendingLimitBigInt = parseUint128(
      input.spendingLimit,
      "Mandate spending limit",
    );
    if (spendingLimitBigInt instanceof Error) {
      return spendingLimitBigInt;
    }
    inputs.push({
      endTime: endTimeBigInt,
      holder: input.holder,
      proposalTypeMask: proposalTypeMaskBigInt,
      roleId: roleIdBigInt,
      spendingLimit: spendingLimitBigInt,
      startTime: startTimeBigInt,
    });
  }

  return [orgIdBigInt, inputs];
}

export function buildBatchSetPolicyRulesCallArgs(
  batch: BatchSetPolicyRulesInput,
): BatchSetPolicyRulesCallArgs | Error {
  const orgIdBigInt = parsePositiveUint64(batch.orgId, "Resolved orgId");
  if (orgIdBigInt instanceof Error) {
    return orgIdBigInt;
  }

  const inputs: ContractBatchPolicyRuleSetInput[] = [];
  for (const input of batch.inputs) {
    const proposalTypeCode = getProposalTypeChainCode(input.proposalType);
    if (proposalTypeCode === undefined) {
      return new Error(`Unsupported proposal type: ${input.proposalType}.`);
    }
    const requiredApprovalBodiesBigInt = parsePolicyBodyIdArray(
      input.requiredApprovalBodies,
      "Required approval bodyId",
    );
    if (requiredApprovalBodiesBigInt instanceof Error) {
      return requiredApprovalBodiesBigInt;
    }
    const vetoBodiesBigInt = parsePolicyBodyIdArray(
      input.vetoBodies,
      "Veto bodyId",
    );
    if (vetoBodiesBigInt instanceof Error) {
      return vetoBodiesBigInt;
    }
    const executorBodyBigInt =
      input.executorBody === "0"
        ? 0n
        : parsePositiveUint64(input.executorBody, "Executor bodyId");
    if (executorBodyBigInt instanceof Error) {
      return executorBodyBigInt;
    }
    const timelockSecondsBigInt = parseUint64(
      input.timelockSeconds,
      "Policy timelock seconds",
    );
    if (timelockSecondsBigInt instanceof Error) {
      return timelockSecondsBigInt;
    }
    inputs.push({
      enabled: input.enabled,
      executorBody: executorBodyBigInt,
      proposalType: proposalTypeCode,
      requiredApprovalBodies: requiredApprovalBodiesBigInt,
      timelockSeconds: timelockSecondsBigInt,
      vetoBodies: vetoBodiesBigInt,
    });
  }

  return [orgIdBigInt, inputs];
}

export function buildCreateBodyPayload(
  action: CreateBodySetupAction,
  resolvedOrgId: string,
): CreateBodyPayload | Error {
  if (!action.active) {
    return new Error(
      "IsoCore createBody creates active bodies only; inactive body drafts are not executable.",
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
      "IsoCore createRole creates active roles only; inactive role drafts are not executable.",
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
