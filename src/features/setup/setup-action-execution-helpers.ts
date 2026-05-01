import type {
  Address,
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateOrganizationSetupAction,
  CreateRoleSetupAction,
  RoleDto,
  SetPolicyRuleSetupAction,
  SetupAction,
} from "@isonia/types";
import { ProposalType, SetupActionKind } from "@isonia/types";
import { isAddress } from "viem";
import type { SetupActionLifecycleStage } from "./setup-action-execution-types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

export function getCreateOrganizationAction(
  actions: readonly SetupAction[],
): CreateOrganizationSetupAction | undefined {
  return actions.find(
    (action): action is CreateOrganizationSetupAction =>
      action.kind === SetupActionKind.CreateOrganization,
  );
}

export function getCreateBodyActions(
  actions: readonly SetupAction[],
): readonly CreateBodySetupAction[] {
  return actions.filter(
    (action): action is CreateBodySetupAction =>
      action.kind === SetupActionKind.CreateBody,
  );
}

export function getCreateRoleActions(
  actions: readonly SetupAction[],
): readonly CreateRoleSetupAction[] {
  return actions.filter(
    (action): action is CreateRoleSetupAction =>
      action.kind === SetupActionKind.CreateRole,
  );
}

export function getAssignMandateActions(
  actions: readonly SetupAction[],
): readonly AssignMandateSetupAction[] {
  return actions.filter(
    (action): action is AssignMandateSetupAction =>
      action.kind === SetupActionKind.AssignMandate,
  );
}

export function getSetPolicyRuleActions(
  actions: readonly SetupAction[],
): readonly SetPolicyRuleSetupAction[] {
  return actions.filter(
    (action): action is SetPolicyRuleSetupAction =>
      action.kind === SetupActionKind.SetPolicyRule,
  );
}

export function resolveBodyReference({
  bodyActions,
  reference,
  resolvedBodyIds,
}: {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly reference: { readonly draftId?: string; readonly indexedId?: string };
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
}): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  const bodyAction = reference.draftId
    ? bodyActions.find((action) => action.bodyDraftId === reference.draftId)
    : undefined;
  return bodyAction ? resolvedBodyIds[bodyAction.actionId] : undefined;
}

export function resolveRoleReference({
  reference,
  resolvedRoleIds,
  roleActions,
}: {
  readonly reference: { readonly draftId?: string; readonly indexedId?: string };
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  const roleAction = reference.draftId
    ? roleActions.find((action) => action.roleDraftId === reference.draftId)
    : undefined;
  return roleAction ? resolvedRoleIds[roleAction.actionId] : undefined;
}

export function resolveRoleReadModel({
  reference,
  resolvedRoles,
  roleActions,
}: {
  readonly reference: { readonly draftId?: string; readonly indexedId?: string };
  readonly resolvedRoles: Readonly<Record<string, RoleDto>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): RoleDto | undefined {
  if (reference.indexedId) {
    return Object.values(resolvedRoles).find(
      (role) => role.roleId === reference.indexedId,
    );
  }

  const roleAction = reference.draftId
    ? roleActions.find((action) => action.roleDraftId === reference.draftId)
    : undefined;
  return roleAction ? resolvedRoles[roleAction.actionId] : undefined;
}

export function resolvePolicyBodyReferences({
  bodyActions,
  label,
  references,
  resolvedBodyIds,
}: {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly label: string;
  readonly references: readonly {
    readonly draftId?: string;
    readonly indexedId?: string;
  }[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
}): readonly string[] | Error {
  const resolvedIds: string[] = [];
  for (const reference of references) {
    const bodyId = resolveBodyReference({
      bodyActions,
      reference,
      resolvedBodyIds,
    });
    if (!bodyId) {
      return new Error(
        `Set policy rule is blocked until every ${label} resolves to a real bodyId.`,
      );
    }
    resolvedIds.push(bodyId);
  }

  return resolvedIds;
}

export function parsePolicyBodyIdArray(
  bodyIds: readonly string[],
  label: string,
): readonly bigint[] | Error {
  const parsed: bigint[] = [];
  for (const bodyId of bodyIds) {
    const bodyIdBigInt = parsePositiveUint64(bodyId, label);
    if (bodyIdBigInt instanceof Error) {
      return bodyIdBigInt;
    }
    parsed.push(bodyIdBigInt);
  }

  return parsed;
}

export function parsePositiveUint64(value: string, label: string): bigint | Error {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    return new Error(`${label} is not a valid uint64 value: ${value}.`);
  }

  if (parsed <= 0n) {
    return new Error(`${label} must be greater than zero: ${value}.`);
  }

  return parsed;
}

export function parseUint64(value: string, label: string): bigint | Error {
  return parseUint(value, label, MAX_UINT64, "uint64");
}

export function parseUint128(value: string, label: string): bigint | Error {
  return parseUint(value, label, MAX_UINT128, "uint128");
}

export function parseUint256(value: string, label: string): bigint | Error {
  return parseUint(value, label, MAX_UINT256, "uint256");
}

export function getPolicyMandateDependencies({
  mandateActions,
  policy,
  roleActions,
}: {
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly policy: SetPolicyRuleSetupAction;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): readonly AssignMandateSetupAction[] {
  const dependencyIds = new Set(policy.dependsOn);
  const dependentRoles = roleActions.filter((role) =>
    dependencyIds.has(role.actionId),
  );

  return mandateActions.filter(
    (mandate) =>
      dependencyIds.has(mandate.actionId) ||
      dependentRoles.some((role) => mandateTargetsRole(mandate, role)),
  );
}

export function getProposalTypeMask(
  proposalTypes: readonly ProposalType[],
): bigint {
  return proposalTypes.reduce(
    (mask, proposalType) => mask | proposalTypeMaskBit(proposalType),
    0n,
  );
}

export function isBusyStage(stage: SetupActionLifecycleStage): boolean {
  return (
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "confirmed_waiting_indexer"
  );
}

export function isConfiguredAddress(value: Address): boolean {
  return isAddress(value) && !isZeroAddress(value);
}

export function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === ZERO_ADDRESS;
}

export function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function normalizeTransactionError(error: unknown): string {
  const message = getErrorMessage(error);

  if (/user rejected|rejected request|denied transaction/i.test(message)) {
    return "Wallet transaction was rejected.";
  }

  if (/reverted|execution reverted|contract function execution/i.test(message)) {
    return `Transaction reverted: ${message}`;
  }

  if (/timeout|timed out/i.test(message)) {
    return message;
  }

  return message;
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}

function parseUint(
  value: string,
  label: string,
  max: bigint,
  typeName: "uint64" | "uint128" | "uint256",
): bigint | Error {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return new Error(`${label} must be a non-negative ${typeName} integer.`);
  }

  let parsed: bigint;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return new Error(`${label} must be a non-negative ${typeName} integer.`);
  }

  if (parsed > max) {
    return new Error(`${label} exceeds the maximum ${typeName} value.`);
  }

  return parsed;
}

function mandateTargetsRole(
  mandate: AssignMandateSetupAction,
  role: CreateRoleSetupAction,
): boolean {
  if (mandate.roleRef.draftId && mandate.roleRef.draftId === role.roleDraftId) {
    return true;
  }

  return Boolean(
    mandate.roleRef.indexedId &&
      role.roleId &&
      mandate.roleRef.indexedId === role.roleId,
  );
}

function proposalTypeMaskBit(proposalType: ProposalType): bigint {
  switch (proposalType) {
    case ProposalType.Standard:
      return 1n << 1n;
    case ProposalType.Treasury:
      return 1n << 2n;
    case ProposalType.Upgrade:
      return 1n << 3n;
    case ProposalType.Emergency:
      return 1n << 4n;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.shortMessage === "string") {
      return record.shortMessage;
    }
    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return "Unknown transaction error.";
}
