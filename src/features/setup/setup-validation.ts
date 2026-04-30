import type {
  Address,
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateOrganizationSetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
  SetupDraft,
  SetupEntityReference,
  SetupValidationWarning,
  SetupValidationWarningSeverity,
} from "@isonia/types";
import {
  BodyKind,
  ProposalType,
  RoleType,
  SetupActionKind,
  SetupDraftStatus,
  SetupValidationWarningCode,
} from "@isonia/types";

export interface SetupValidationSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly blocked: boolean;
}

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const MAX_UINT64 = 18_446_744_073_709_551_615n;
const ALPHA_MAX_TIMELOCK_SECONDS = 2_592_000n;

const MIN_REVIEW_TIMELOCK_SECONDS: Record<ProposalType, bigint> = {
  [ProposalType.Emergency]: 0n,
  [ProposalType.Standard]: 300n,
  [ProposalType.Treasury]: 3_600n,
  [ProposalType.Upgrade]: 3_600n,
};

export function applySetupValidation(draft: SetupDraft): SetupDraft {
  const warnings = validateSetupDraft(draft);

  return {
    ...draft,
    actions: attachSetupActionWarnings(draft.actions, warnings),
    status: deriveSetupDraftStatus(warnings),
    warnings,
  };
}

export function validateSetupDraft(
  draft: Pick<SetupDraft, "actions" | "organization">,
): readonly SetupValidationWarning[] {
  const warnings: SetupValidationWarning[] = [];
  const actions = draft.actions;
  const bodies = actions.filter(isBodyAction);
  const roles = actions.filter(isRoleAction);
  const mandates = actions.filter(isMandateAction);
  const policies = actions.filter(isPolicyAction);

  validateOrganizationAdmin(draft, warnings);
  validateActionDependencies(actions, warnings);
  validateActionReferences(draft, warnings);

  mandates.forEach((mandate) => {
    validateAddress({
      actionId: mandate.actionId,
      emptyMessage:
        "Mandate holder address is required before setup transactions can be prepared.",
      invalidMessage: "Mandate holder address must be a 20-byte EVM address.",
      label: "Mandate holder address",
      relatedMandateId: mandate.mandateDraftId,
      relatedRoleId: mandate.roleRef.draftId ?? mandate.roleRef.indexedId,
      value: mandate.holderAddress,
      warnings,
    });
  });

  validateRequiredBodyHolder({
    bodyKind: BodyKind.GeneralCouncil,
    bodyActions: bodies,
    code: SetupValidationWarningCode.MissingApproverMandate,
    message:
      "General Council holders are required so standard governance routes have eligible approvers.",
    mandateActions: mandates,
    roleActions: roles,
    roleTypes: [RoleType.BodyAdmin, RoleType.Proposer, RoleType.Approver],
    warnings,
  });

  validateRequiredBodyHolder({
    bodyKind: BodyKind.TreasuryCommittee,
    bodyActions: bodies,
    code: SetupValidationWarningCode.MissingApproverMandate,
    message:
      "Treasury Committee holders are required so treasury routes have eligible approvers.",
    mandateActions: mandates,
    roleActions: roles,
    roleTypes: [RoleType.Approver],
    warnings,
  });

  validateRequiredBodyHolder({
    bodyKind: BodyKind.SecurityCouncil,
    bodyActions: bodies,
    code: SetupValidationWarningCode.MissingVetoMandate,
    message:
      "Security Council holders are required so veto and emergency routes have eligible holders.",
    mandateActions: mandates,
    roleActions: roles,
    roleTypes: [RoleType.Approver, RoleType.Vetoer, RoleType.EmergencyOperator],
    warnings,
  });

  policies.forEach((policy) => {
    validateTimelock(policy, warnings);

    if (!policy.enabled) {
      return;
    }

    let routeHasMissingEligibleHolder = false;

    if (policy.requiredApprovalBodies.length === 0) {
      routeHasMissingEligibleHolder = true;
      warnings.push({
        actionId: policy.actionId,
        code: SetupValidationWarningCode.EmptyRequiredApprovals,
        message: `${formatProposalType(policy.proposalType)} policy has no required approval body.`,
        proposalType: policy.proposalType,
        severity: "error",
      });
    }

    policy.requiredApprovalBodies.forEach((body) => {
      routeHasMissingEligibleHolder =
        validateBodyResponsibility({
          body,
          mandateActions: mandates,
          missingCode: SetupValidationWarningCode.MissingApproverMandate,
          missingMessage: `${formatBodyRef(body)} has no eligible approver mandate for ${formatProposalType(policy.proposalType)} proposals.`,
          policy,
          responsibility: "approver",
          roleActions: roles,
          roleTypes: [RoleType.Approver],
          warnings,
        }) || routeHasMissingEligibleHolder;
    });

    policy.vetoBodies.forEach((body) => {
      routeHasMissingEligibleHolder =
        validateBodyResponsibility({
          body,
          mandateActions: mandates,
          missingCode: SetupValidationWarningCode.MissingVetoMandate,
          missingMessage: `${formatBodyRef(body)} has no eligible veto mandate for ${formatProposalType(policy.proposalType)} proposals.`,
          policy,
          responsibility: "vetoer",
          roleActions: roles,
          roleTypes: [RoleType.Vetoer],
          warnings,
        }) || routeHasMissingEligibleHolder;
    });

    if (!policy.executorBody) {
      routeHasMissingEligibleHolder = true;
      warnings.push({
        actionId: policy.actionId,
        code: SetupValidationWarningCode.MissingExecutorMandate,
        message: `${formatProposalType(policy.proposalType)} policy has no executor body.`,
        proposalType: policy.proposalType,
        severity: "error",
      });
    } else {
      routeHasMissingEligibleHolder =
        validateBodyResponsibility({
          body: policy.executorBody,
          mandateActions: mandates,
          missingCode: SetupValidationWarningCode.MissingExecutorMandate,
          missingMessage: `${formatBodyRef(policy.executorBody)} has no eligible executor mandate for ${formatProposalType(policy.proposalType)} proposals.`,
          policy,
          responsibility: "executor",
          roleActions: roles,
          roleTypes: [RoleType.Executor],
          warnings,
        }) || routeHasMissingEligibleHolder;
    }

    if (routeHasMissingEligibleHolder) {
      warnings.push({
        actionId: policy.actionId,
        code: SetupValidationWarningCode.PolicyRouteWithoutEligibleHolder,
        message: `${formatProposalType(policy.proposalType)} policy route is blocked because at least one responsibility has no eligible holder.`,
        proposalType: policy.proposalType,
        severity: "error",
      });
    }
  });

  return warnings;
}

export function attachSetupActionWarnings(
  actions: readonly SetupAction[],
  warnings: readonly SetupValidationWarning[],
): readonly SetupAction[] {
  return actions.map((action) => {
    const actionWarnings = warnings.filter(
      (warning) => warning.actionId === action.actionId,
    );

    switch (action.kind) {
      case SetupActionKind.CreateOrganization:
        return { ...action, warnings: actionWarnings };
      case SetupActionKind.CreateBody:
        return { ...action, warnings: actionWarnings };
      case SetupActionKind.CreateRole:
        return { ...action, warnings: actionWarnings };
      case SetupActionKind.AssignMandate:
        return { ...action, warnings: actionWarnings };
      case SetupActionKind.SetPolicyRule:
        return { ...action, warnings: actionWarnings };
    }
  });
}

export function summarizeSetupValidationWarnings(
  warnings: readonly SetupValidationWarning[],
): SetupValidationSummary {
  return {
    blocked: warnings.some((warning) => warning.severity === "error"),
    errors: countWarningsBySeverity(warnings, "error"),
    info: countWarningsBySeverity(warnings, "info"),
    warnings: countWarningsBySeverity(warnings, "warning"),
  };
}

export function deriveSetupDraftStatus(
  warnings: readonly SetupValidationWarning[],
): SetupDraftStatus {
  return warnings.some((warning) => warning.severity === "error")
    ? SetupDraftStatus.Blocked
    : SetupDraftStatus.ReadyForReview;
}

function validateOrganizationAdmin(
  draft: Pick<SetupDraft, "actions" | "organization">,
  warnings: SetupValidationWarning[],
): void {
  const organizationAction = draft.actions.find(
    (action): action is CreateOrganizationSetupAction =>
      action.kind === SetupActionKind.CreateOrganization,
  );
  const actionId =
    organizationAction?.actionId ??
    draft.actions.find((action) => action.requiredSignerAddress === undefined)
      ?.actionId;

  validateAddress({
    actionId,
    emptyMessage:
      "Organization admin address is required before setup transactions can be prepared.",
    invalidMessage: "Organization admin address must be a 20-byte EVM address.",
    label: "Organization admin address",
    value: draft.organization?.adminAddress,
    warnings,
  });
}

function validateActionDependencies(
  actions: readonly SetupAction[],
  warnings: SetupValidationWarning[],
): void {
  const actionIds = new Set(actions.map((action) => action.actionId));

  actions.forEach((action) => {
    action.dependsOn.forEach((dependencyActionId) => {
      if (actionIds.has(dependencyActionId)) {
        return;
      }

      warnings.push({
        actionId: action.actionId,
        code: SetupValidationWarningCode.MissingActionDependency,
        message: `${action.label} depends on missing action ${dependencyActionId}.`,
        severity: "error",
      });
    });
  });
}

function validateActionReferences(
  draft: Pick<SetupDraft, "actions" | "organization">,
  warnings: SetupValidationWarning[],
): void {
  const actions = draft.actions;
  const organizationAction = actions.find(isOrganizationAction);
  const bodyActions = actions.filter(isBodyAction);
  const roleActions = actions.filter(isRoleAction);

  actions.forEach((action) => {
    switch (action.kind) {
      case SetupActionKind.CreateOrganization:
        return;
      case SetupActionKind.CreateBody:
        if (
          !hasOrganizationReference(
            action.organizationRef,
            draft.organization,
            organizationAction,
          )
        ) {
          warnings.push({
            actionId: action.actionId,
            code: SetupValidationWarningCode.MissingActionDependency,
            message: `${action.label} references an organization that is not created or indexed in this draft.`,
            severity: "error",
          });
        }
        return;
      case SetupActionKind.CreateRole:
        if (!hasBodyReference(action.bodyRef, bodyActions)) {
          warnings.push({
            actionId: action.actionId,
            code: SetupValidationWarningCode.MissingActionDependency,
            message: `${action.label} references a body that is not created or indexed in this draft.`,
            relatedBodyId: action.bodyRef.draftId ?? action.bodyRef.indexedId,
            severity: "error",
          });
        }
        return;
      case SetupActionKind.AssignMandate:
        if (!hasRoleReference(action.roleRef, roleActions)) {
          warnings.push({
            actionId: action.actionId,
            code: SetupValidationWarningCode.MissingActionDependency,
            message: `${action.label} references a role that is not created or indexed in this draft.`,
            relatedRoleId: action.roleRef.draftId ?? action.roleRef.indexedId,
            severity: "error",
          });
        }
        return;
      case SetupActionKind.SetPolicyRule:
        if (
          !hasOrganizationReference(
            action.organizationRef,
            draft.organization,
            organizationAction,
          )
        ) {
          warnings.push({
            actionId: action.actionId,
            code: SetupValidationWarningCode.MissingActionDependency,
            message: `${action.label} references an organization that is not created or indexed in this draft.`,
            proposalType: action.proposalType,
            severity: "error",
          });
        }

        action.requiredApprovalBodies.forEach((body) => {
          validatePolicyBodyReference(action, body, bodyActions, warnings);
        });
        action.vetoBodies.forEach((body) => {
          validatePolicyBodyReference(action, body, bodyActions, warnings);
        });
        if (action.executorBody) {
          validatePolicyBodyReference(
            action,
            action.executorBody,
            bodyActions,
            warnings,
          );
        }
        return;
    }
  });
}

function validatePolicyBodyReference(
  policy: SetPolicyRuleSetupAction,
  body: SetupEntityReference,
  bodyActions: readonly CreateBodySetupAction[],
  warnings: SetupValidationWarning[],
): void {
  if (hasBodyReference(body, bodyActions)) {
    return;
  }

  warnings.push({
    actionId: policy.actionId,
    code: SetupValidationWarningCode.MissingActionDependency,
    message: `${policy.label} references ${formatBodyRef(body)}, but that body is not created or indexed in this draft.`,
    proposalType: policy.proposalType,
    relatedBodyId: body.draftId ?? body.indexedId,
    severity: "error",
  });
}

function validateRequiredBodyHolder({
  bodyActions,
  bodyKind,
  code,
  mandateActions,
  message,
  roleActions,
  roleTypes,
  warnings,
}: {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly bodyKind: BodyKind;
  readonly code: SetupValidationWarningCode;
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly message: string;
  readonly roleActions: readonly CreateRoleSetupAction[];
  readonly roleTypes: readonly RoleType[];
  readonly warnings: SetupValidationWarning[];
}): void {
  const body = bodyActions.find((candidate) => candidate.bodyKind === bodyKind);
  if (!body) {
    return;
  }

  const bodyRoles = roleActions.filter((role) =>
    roleTypes.includes(role.roleType) &&
    matchesBodyReference(role.bodyRef, {
      draftId: body.bodyDraftId,
      indexedId: body.bodyId,
    }),
  );
  const bodyMandates = mandateActions.filter((mandate) =>
    bodyRoles.some((role) => matchesRoleReference(mandate.roleRef, role)),
  );
  const usableBodyMandates = bodyMandates.filter((mandate) =>
    isUsableAddress(mandate.holderAddress),
  );

  if (usableBodyMandates.length > 0) {
    return;
  }

  warnings.push({
    actionId: body.actionId,
    code,
    message,
    relatedBodyId: body.bodyDraftId,
    severity: "error",
  });
}

function validateBodyResponsibility({
  body,
  mandateActions,
  missingCode,
  missingMessage,
  policy,
  responsibility,
  roleActions,
  roleTypes,
  warnings,
}: {
  readonly body: SetupEntityReference;
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly missingCode: SetupValidationWarningCode;
  readonly missingMessage: string;
  readonly policy: SetPolicyRuleSetupAction;
  readonly responsibility: "approver" | "vetoer" | "executor";
  readonly roleActions: readonly CreateRoleSetupAction[];
  readonly roleTypes: readonly RoleType[];
  readonly warnings: SetupValidationWarning[];
}): boolean {
  const bodyRoles = roleActions.filter(
    (role) =>
      role.active &&
      roleTypes.includes(role.roleType) &&
      matchesBodyReference(role.bodyRef, body),
  );
  const candidateMandates = mandateActions.filter((mandate) =>
    bodyRoles.some((role) => matchesRoleReference(mandate.roleRef, role)),
  );
  const validHolderMandates = candidateMandates.filter((mandate) =>
    isUsableAddress(mandate.holderAddress),
  );

  if (validHolderMandates.length === 0) {
    warnings.push({
      actionId: policy.actionId,
      code: missingCode,
      message: missingMessage,
      proposalType: policy.proposalType,
      relatedBodyId: body.draftId ?? body.indexedId,
      severity: "error",
    });
    return true;
  }

  const scopedMandates = validHolderMandates.filter((mandate) =>
    mandateCoversProposalType(mandate, policy.proposalType),
  );

  if (scopedMandates.length === 0) {
    warnings.push({
      actionId: policy.actionId,
      code: SetupValidationWarningCode.ProposalTypeScopeMismatch,
      message: `${formatBodyRef(body)} has ${responsibility} holder mandates, but none cover ${formatProposalType(policy.proposalType)} proposals.`,
      proposalType: policy.proposalType,
      relatedBodyId: body.draftId ?? body.indexedId,
      severity: "error",
    });
    return true;
  }

  return false;
}

function validateAddress({
  actionId,
  emptyMessage,
  invalidMessage,
  label,
  relatedMandateId,
  relatedRoleId,
  value,
  warnings,
}: {
  readonly actionId?: string;
  readonly emptyMessage: string;
  readonly invalidMessage: string;
  readonly label: string;
  readonly relatedMandateId?: string;
  readonly relatedRoleId?: string;
  readonly value?: string;
  readonly warnings: SetupValidationWarning[];
}): void {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    warnings.push({
      actionId,
      code: SetupValidationWarningCode.InvalidAddress,
      message: emptyMessage,
      relatedMandateId,
      relatedRoleId,
      severity: "error",
    });
    return;
  }

  if (isZeroAddress(trimmed)) {
    warnings.push({
      actionId,
      code: SetupValidationWarningCode.ZeroAddressAuthority,
      message: `${label} is the zero address and cannot be treated as final setup authority.`,
      relatedMandateId,
      relatedRoleId,
      severity: "error",
    });
    return;
  }

  if (!isAddress(trimmed)) {
    warnings.push({
      actionId,
      code: SetupValidationWarningCode.InvalidAddress,
      message: invalidMessage,
      relatedMandateId,
      relatedRoleId,
      severity: "error",
    });
  }
}

function validateTimelock(
  policy: SetPolicyRuleSetupAction,
  warnings: SetupValidationWarning[],
): void {
  const parsed = parseTimelockSeconds(policy.timelockSeconds);
  if (parsed === undefined) {
    warnings.push({
      actionId: policy.actionId,
      code: SetupValidationWarningCode.InvalidTimelock,
      message: `${formatProposalType(policy.proposalType)} timelock must be a non-negative uint64 integer in seconds.`,
      proposalType: policy.proposalType,
      severity: "error",
    });
    return;
  }

  if (policy.proposalType === ProposalType.Emergency && parsed === 0n) {
    warnings.push({
      actionId: policy.actionId,
      code: SetupValidationWarningCode.InvalidTimelock,
      message:
        "Emergency policy uses a zero timelock. This can be valid for alpha emergency handling, but it should be an explicit review choice.",
      proposalType: policy.proposalType,
      severity: "info",
    });
    return;
  }

  const minimum = MIN_REVIEW_TIMELOCK_SECONDS[policy.proposalType];
  if (parsed < minimum) {
    warnings.push({
      actionId: policy.actionId,
      code: SetupValidationWarningCode.InvalidTimelock,
      message: `${formatProposalType(policy.proposalType)} timelock is shorter than the alpha review baseline of ${minimum.toString()} seconds.`,
      proposalType: policy.proposalType,
      severity: "warning",
    });
  }

  if (parsed > ALPHA_MAX_TIMELOCK_SECONDS) {
    warnings.push({
      actionId: policy.actionId,
      code: SetupValidationWarningCode.InvalidTimelock,
      message: `${formatProposalType(policy.proposalType)} timelock is longer than 30 days, which may make alpha testing difficult.`,
      proposalType: policy.proposalType,
      severity: "warning",
    });
  }
}

function hasOrganizationReference(
  reference: SetupEntityReference,
  organization: SetupDraft["organization"],
  organizationAction?: CreateOrganizationSetupAction,
): boolean {
  if (reference.indexedId) {
    return true;
  }

  if (!reference.draftId) {
    return false;
  }

  return (
    organization?.draftId === reference.draftId ||
    organizationAction?.organizationDraftId === reference.draftId
  );
}

function hasBodyReference(
  reference: SetupEntityReference,
  bodyActions: readonly CreateBodySetupAction[],
): boolean {
  if (reference.indexedId) {
    return true;
  }

  return bodyActions.some(
    (body) => reference.draftId !== undefined && body.bodyDraftId === reference.draftId,
  );
}

function hasRoleReference(
  reference: SetupEntityReference,
  roleActions: readonly CreateRoleSetupAction[],
): boolean {
  if (reference.indexedId) {
    return true;
  }

  return roleActions.some(
    (role) => reference.draftId !== undefined && role.roleDraftId === reference.draftId,
  );
}

function matchesBodyReference(
  roleBodyReference: SetupEntityReference,
  targetBodyReference: SetupEntityReference,
): boolean {
  if (
    roleBodyReference.draftId &&
    targetBodyReference.draftId &&
    roleBodyReference.draftId === targetBodyReference.draftId
  ) {
    return true;
  }

  return Boolean(
    roleBodyReference.indexedId &&
      targetBodyReference.indexedId &&
      roleBodyReference.indexedId === targetBodyReference.indexedId,
  );
}

function matchesRoleReference(
  mandateRoleReference: SetupEntityReference,
  role: CreateRoleSetupAction,
): boolean {
  if (
    mandateRoleReference.draftId &&
    mandateRoleReference.draftId === role.roleDraftId
  ) {
    return true;
  }

  return Boolean(
    mandateRoleReference.indexedId &&
      role.roleId &&
      mandateRoleReference.indexedId === role.roleId,
  );
}

function mandateCoversProposalType(
  mandate: AssignMandateSetupAction,
  proposalType: ProposalType,
): boolean {
  if (mandate.proposalTypes) {
    return mandate.proposalTypes.includes(proposalType);
  }

  try {
    const mask = BigInt(mandate.proposalTypeMask);
    return (mask & proposalTypeMaskBit(proposalType)) !== 0n;
  } catch {
    return false;
  }
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

function countWarningsBySeverity(
  warnings: readonly SetupValidationWarning[],
  severity: SetupValidationWarningSeverity,
): number {
  return warnings.filter((warning) => warning.severity === severity).length;
}

function isUsableAddress(value: string): boolean {
  return isAddress(value) && !isZeroAddress(value);
}

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === ZERO_ADDRESS;
}

function parseTimelockSeconds(value: string): bigint | undefined {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  try {
    const parsed = BigInt(trimmed);
    return parsed <= MAX_UINT64 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function formatBodyRef(reference: SetupEntityReference): string {
  if (reference.draftId) {
    return formatLabel(reference.draftId.replace(/^body-/, ""));
  }
  return reference.indexedId ? `Body #${reference.indexedId}` : "Unresolved body";
}

function formatProposalType(proposalType: ProposalType): string {
  return formatLabel(proposalType);
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function isOrganizationAction(
  action: SetupAction,
): action is CreateOrganizationSetupAction {
  return action.kind === SetupActionKind.CreateOrganization;
}

function isBodyAction(action: SetupAction): action is CreateBodySetupAction {
  return action.kind === SetupActionKind.CreateBody;
}

function isRoleAction(action: SetupAction): action is CreateRoleSetupAction {
  return action.kind === SetupActionKind.CreateRole;
}

function isMandateAction(
  action: SetupAction,
): action is AssignMandateSetupAction {
  return action.kind === SetupActionKind.AssignMandate;
}

function isPolicyAction(
  action: SetupAction,
): action is SetPolicyRuleSetupAction {
  return action.kind === SetupActionKind.SetPolicyRule;
}
