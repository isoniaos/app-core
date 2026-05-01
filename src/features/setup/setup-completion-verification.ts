import type {
  AssignMandateSetupAction,
  BodyDto,
  CreateBodySetupAction,
  CreateOrganizationSetupAction,
  CreateRoleSetupAction,
  MandateDto,
  OrganizationDto,
  OrganizationPolicyDto,
  RoleDto,
  SetPolicyRuleSetupAction,
  SetupAction,
  SetupDraft,
  SetupEntityReference,
} from "@isonia/types";
import { SetupActionExecutionStatus, SetupActionKind } from "@isonia/types";
import type {
  SetupActionLifecycleStage,
  SetupActionTransaction,
  SetupDraftExecutionState,
} from "./setup-action-execution-types";

export type SetupCompletionReadiness =
  | "not_started"
  | "in_progress"
  | "partially_indexed"
  | "blocked"
  | "completed";

export type SetupCompletionActionState =
  | "not_started"
  | "in_progress"
  | "indexed"
  | "failed"
  | "blocked"
  | "unresolved_dependency"
  | "missing_indexed_entity"
  | "unresolved_policy_rule";

export interface SetupCompletionReadModels {
  readonly bodies: readonly BodyDto[];
  readonly mandates: readonly MandateDto[];
  readonly organization?: OrganizationDto;
  readonly policies: readonly OrganizationPolicyDto[];
  readonly roles: readonly RoleDto[];
}

export interface SetupCompletionIssue {
  readonly actionId: string;
  readonly actionKind: SetupActionKind;
  readonly label: string;
  readonly message: string;
}

export interface SetupCompletionDependencyIssue extends SetupCompletionIssue {
  readonly dependencyActionId: string;
  readonly dependencyLabel: string;
}

export interface SetupCompletionActionVerification {
  readonly actionId: string;
  readonly indexedEntityId?: string;
  readonly kind: SetupActionKind;
  readonly label: string;
  readonly message: string;
  readonly state: SetupCompletionActionState;
  readonly txHash?: `0x${string}`;
  readonly unresolvedDependencies: readonly SetupCompletionDependencyIssue[];
}

export interface SetupCompletionVerification {
  readonly actionResults: readonly SetupCompletionActionVerification[];
  readonly blockedActionIssues: readonly SetupCompletionIssue[];
  readonly blockedActions: number;
  readonly failedActionIssues: readonly SetupCompletionIssue[];
  readonly failedActions: number;
  readonly indexedActions: number;
  readonly indexedOrgId?: string;
  readonly inProgressActions: number;
  readonly missingIndexedEntities: readonly SetupCompletionIssue[];
  readonly readiness: SetupCompletionReadiness;
  readonly totalActions: number;
  readonly unresolvedDependencies: readonly SetupCompletionDependencyIssue[];
  readonly unresolvedPolicyRules: readonly SetupCompletionIssue[];
}

interface IndexedReadModelSource {
  readonly bodies: readonly BodyDto[];
  readonly mandates: readonly MandateDto[];
  readonly organizations: readonly OrganizationDto[];
  readonly policies: readonly OrganizationPolicyDto[];
  readonly roles: readonly RoleDto[];
}

interface VerificationContext {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly bodyByActionId: Map<string, BodyDto>;
  readonly draft: SetupDraft;
  readonly executionState?: SetupDraftExecutionState;
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly mandateByActionId: Map<string, MandateDto>;
  organization?: OrganizationDto;
  readonly policyByActionId: Map<string, OrganizationPolicyDto>;
  readonly readModels?: SetupCompletionReadModels;
  readonly resultByActionId: Map<string, SetupCompletionActionVerification>;
  readonly roleActions: readonly CreateRoleSetupAction[];
  readonly roleByActionId: Map<string, RoleDto>;
  readonly source: IndexedReadModelSource;
}

interface InternalActionVerification
  extends SetupCompletionActionVerification {
  readonly body?: BodyDto;
  readonly mandate?: MandateDto;
  readonly organization?: OrganizationDto;
  readonly policy?: OrganizationPolicyDto;
  readonly role?: RoleDto;
}

export function verifySetupCompletion({
  draft,
  executionState,
  readModels,
}: {
  readonly draft: SetupDraft;
  readonly executionState?: SetupDraftExecutionState;
  readonly readModels?: SetupCompletionReadModels;
}): SetupCompletionVerification {
  const source = buildIndexedReadModelSource(executionState, readModels);
  const context: VerificationContext = {
    bodyActions: draft.actions.filter(isCreateBodyAction),
    bodyByActionId: new Map(),
    draft,
    executionState,
    mandateActions: draft.actions.filter(isAssignMandateAction),
    mandateByActionId: new Map(),
    organization: undefined,
    policyByActionId: new Map(),
    readModels,
    resultByActionId: new Map(),
    roleActions: draft.actions.filter(isCreateRoleAction),
    roleByActionId: new Map(),
    source,
  };

  const internalResults: InternalActionVerification[] = [];
  for (const action of draft.actions) {
    const result = verifyAction(action, context);
    internalResults.push(result);
    context.resultByActionId.set(action.actionId, result);

    if (result.organization) {
      context.organization = result.organization;
    }
    if (result.body) {
      context.bodyByActionId.set(action.actionId, result.body);
    }
    if (result.role) {
      context.roleByActionId.set(action.actionId, result.role);
    }
    if (result.mandate) {
      context.mandateByActionId.set(action.actionId, result.mandate);
    }
    if (result.policy) {
      context.policyByActionId.set(action.actionId, result.policy);
    }
  }

  const actionResults = internalResults.map(stripInternalResult);
  const blockedActionIssues = toIssues(
    actionResults.filter((result) => result.state === "blocked"),
  );
  const failedActionIssues = toIssues(
    actionResults.filter((result) => result.state === "failed"),
  );
  const missingIndexedEntities = toIssues(
    actionResults.filter((result) => result.state === "missing_indexed_entity"),
  );
  const unresolvedPolicyRules = toIssues(
    actionResults.filter((result) => result.state === "unresolved_policy_rule"),
  );
  const unresolvedDependencies = actionResults.flatMap(
    (result) => result.unresolvedDependencies,
  );
  const indexedActions = countByState(actionResults, "indexed");
  const failedActions = failedActionIssues.length;
  const blockedActions = blockedActionIssues.length;
  const inProgressActions = countByState(actionResults, "in_progress");

  return {
    actionResults,
    blockedActionIssues,
    blockedActions,
    failedActionIssues,
    failedActions,
    indexedActions,
    indexedOrgId: resolveIndexedOrgId(context),
    inProgressActions,
    missingIndexedEntities,
    readiness: deriveCompletionReadiness({
      blockedActions,
      failedActions,
      indexedActions,
      inProgressActions,
      missingIndexedEntities: missingIndexedEntities.length,
      totalActions: actionResults.length,
      unresolvedPolicyRules: unresolvedPolicyRules.length,
    }),
    totalActions: actionResults.length,
    unresolvedDependencies,
    unresolvedPolicyRules,
  };
}

function verifyAction(
  action: SetupAction,
  context: VerificationContext,
): InternalActionVerification {
  const transaction = getActionTransaction(action, context.executionState);
  const indexed = findIndexedResult(action, context);
  if (indexed) {
    return indexedResult(action, transaction, indexed);
  }

  if (
    transaction?.stage === "failed" ||
    action.executionStatus === SetupActionExecutionStatus.Failed
  ) {
    return issueResult({
      action,
      message: transaction?.error ?? "The setup action failed.",
      state: "failed",
      transaction,
    });
  }

  if (
    transaction &&
    isInProgressStage(transaction.stage) ||
    action.executionStatus === SetupActionExecutionStatus.WaitingForSignature ||
    action.executionStatus === SetupActionExecutionStatus.Submitted ||
    action.executionStatus === SetupActionExecutionStatus.Confirmed
  ) {
    return issueResult({
      action,
      message: `The setup action is ${formatExecutionStage(
        transaction?.stage ?? "submitted",
      )} and has not reached an indexed read model yet.`,
      state: "in_progress",
      transaction,
    });
  }

  const blockingWarning = action.warnings.find(
    (warning) => warning.severity === "error",
  );
  if (blockingWarning) {
    return issueResult({
      action,
      message: blockingWarning.message,
      state: "blocked",
      transaction,
    });
  }

  const blockedDependency = getBlockedDependency(action, context);
  if (blockedDependency) {
    return issueResult({
      action,
      message: `${blockedDependency.dependencyLabel} must be unblocked before this action can complete.`,
      state: "blocked",
      transaction,
    });
  }

  const unresolvedDependencies = getUnresolvedDependencies(action, context);
  if (unresolvedDependencies.length > 0) {
    return {
      actionId: action.actionId,
      kind: action.kind,
      label: action.label,
      message: `Waiting for ${unresolvedDependencies.length.toLocaleString()} dependency action${unresolvedDependencies.length === 1 ? "" : "s"} to reach indexed read-model state.`,
      state: "unresolved_dependency",
      txHash: transaction?.txHash,
      unresolvedDependencies,
    };
  }

  if (action.kind === SetupActionKind.SetPolicyRule) {
    return issueResult({
      action,
      message: getMissingPolicyMessage(action, context),
      state: "unresolved_policy_rule",
      transaction,
    });
  }

  if (shouldReportMissingIndexedEntity(action, context)) {
    return issueResult({
      action,
      message: getMissingEntityMessage(action),
      state: "missing_indexed_entity",
      transaction,
    });
  }

  return issueResult({
    action,
    message:
      "No transaction or matching indexed read model has been observed for this setup action.",
    state: "not_started",
    transaction,
  });
}

function findIndexedResult(
  action: SetupAction,
  context: VerificationContext,
): InternalActionVerification | undefined {
  switch (action.kind) {
    case SetupActionKind.CreateOrganization: {
      const organization = findIndexedOrganization(action, context);
      return organization
        ? {
            ...baseIndexedResult(
              action,
              getActionTransaction(action, context.executionState),
              `Organization #${organization.orgId} is indexed.`,
              organization.orgId,
            ),
            organization,
          }
        : undefined;
    }
    case SetupActionKind.CreateBody: {
      const body = findIndexedBody(action, context);
      return body
        ? {
            ...baseIndexedResult(
              action,
              getActionTransaction(action, context.executionState),
              `Body #${body.bodyId} is indexed.`,
              body.bodyId,
            ),
            body,
          }
        : undefined;
    }
    case SetupActionKind.CreateRole: {
      const role = findIndexedRole(action, context);
      return role
        ? {
            ...baseIndexedResult(
              action,
              getActionTransaction(action, context.executionState),
              `Role #${role.roleId} is indexed.`,
              role.roleId,
            ),
            role,
          }
        : undefined;
    }
    case SetupActionKind.AssignMandate: {
      const mandate = findIndexedMandate(action, context);
      return mandate
        ? {
            ...baseIndexedResult(
              action,
              getActionTransaction(action, context.executionState),
              `Mandate #${mandate.mandateId} is indexed.`,
              mandate.mandateId,
            ),
            mandate,
          }
        : undefined;
    }
    case SetupActionKind.SetPolicyRule: {
      const policy = findIndexedPolicy(action, context);
      return policy
        ? {
            ...baseIndexedResult(
              action,
              getActionTransaction(action, context.executionState),
              `${formatProposalType(action.proposalType)} policy v${policy.version} is indexed.`,
              policy.version,
            ),
            policy,
          }
        : undefined;
    }
  }
}

function findIndexedOrganization(
  action: CreateOrganizationSetupAction,
  context: VerificationContext,
): OrganizationDto | undefined {
  const transaction = context.executionState?.createOrganization;
  const expectedOrgId =
    action.orgId ?? transaction?.orgId ?? context.executionState?.resolvedOrgId;
  if (expectedOrgId) {
    const byOrgId = context.source.organizations.find(
      (organization) => organization.orgId === expectedOrgId,
    );
    if (byOrgId) {
      return byOrgId;
    }
  }

  const txHash = action.createdTxHash ?? action.txHash ?? transaction?.txHash;
  if (txHash) {
    const byTxHash = context.source.organizations.find((organization) =>
      sameHex(organization.createdTxHash, txHash),
    );
    if (byTxHash) {
      return byTxHash;
    }
  }

  return context.source.organizations.find(
    (organization) =>
      sameAddress(organization.adminAddress, action.adminAddress) &&
      (!action.metadataUri || organization.metadataUri === action.metadataUri) &&
      (!transaction?.slug || organization.slug === transaction.slug),
  );
}

function findIndexedBody(
  action: CreateBodySetupAction,
  context: VerificationContext,
): BodyDto | undefined {
  const transaction = context.executionState?.createBodies[action.actionId];
  const expectedBodyId =
    action.bodyId ??
    transaction?.bodyId ??
    context.executionState?.resolvedBodyIds[action.actionId];
  if (expectedBodyId) {
    const byBodyId = context.source.bodies.find(
      (body) =>
        body.bodyId === expectedBodyId &&
        body.kind === action.bodyKind &&
        bodyMatchesOrganization(body, action.organizationRef, context),
    );
    if (byBodyId) {
      return bodyMatchesBodyAction(byBodyId, action) ? byBodyId : undefined;
    }
  }

  return context.source.bodies.find(
    (body) =>
      body.kind === action.bodyKind &&
      bodyMatchesOrganization(body, action.organizationRef, context) &&
      bodyMatchesBodyAction(body, action),
  );
}

function findIndexedRole(
  action: CreateRoleSetupAction,
  context: VerificationContext,
): RoleDto | undefined {
  const transaction = context.executionState?.createRoles[action.actionId];
  const expectedRoleId =
    action.roleId ??
    transaction?.roleId ??
    context.executionState?.resolvedRoleIds[action.actionId];
  if (expectedRoleId) {
    const byRoleId = context.source.roles.find(
      (role) => role.roleId === expectedRoleId && role.roleType === action.roleType,
    );
    if (byRoleId) {
      return roleMatchesRoleAction(byRoleId, action, context)
        ? byRoleId
        : undefined;
    }
  }

  return context.source.roles.find((role) =>
    roleMatchesRoleAction(role, action, context),
  );
}

function findIndexedMandate(
  action: AssignMandateSetupAction,
  context: VerificationContext,
): MandateDto | undefined {
  const transaction = context.executionState?.assignMandates[action.actionId];
  const expectedMandateId =
    action.mandateId ??
    transaction?.mandateId ??
    context.executionState?.resolvedMandateIds[action.actionId];
  if (expectedMandateId) {
    const byMandateId = context.source.mandates.find(
      (mandate) => mandate.mandateId === expectedMandateId,
    );
    if (byMandateId) {
      return mandateMatchesMandateAction(byMandateId, action, context)
        ? byMandateId
        : undefined;
    }
  }

  return context.source.mandates.find((mandate) =>
    mandateMatchesMandateAction(mandate, action, context),
  );
}

function findIndexedPolicy(
  action: SetPolicyRuleSetupAction,
  context: VerificationContext,
): OrganizationPolicyDto | undefined {
  const transaction = context.executionState?.setPolicyRules[action.actionId];
  const expectedVersion =
    action.policyVersion ??
    transaction?.policyVersion ??
    context.executionState?.resolvedPolicyVersions[action.actionId];
  if (expectedVersion) {
    const byVersion = context.source.policies.find(
      (policy) =>
        policy.proposalType === action.proposalType &&
        policy.version === expectedVersion,
    );
    if (byVersion) {
      return policyMatchesPolicyAction(byVersion, action, context)
        ? byVersion
        : undefined;
    }
  }

  return context.source.policies.find((policy) =>
    policyMatchesPolicyAction(policy, action, context),
  );
}

function bodyMatchesOrganization(
  body: BodyDto,
  reference: SetupEntityReference,
  context: VerificationContext,
): boolean {
  const expectedOrgId = resolveOrganizationReference(reference, context);
  return expectedOrgId ? body.orgId === expectedOrgId : true;
}

function bodyMatchesBodyAction(
  body: BodyDto,
  action: CreateBodySetupAction,
): boolean {
  return (
    body.active === action.active &&
    (!action.metadataUri || body.metadataUri === action.metadataUri)
  );
}

function roleMatchesRoleAction(
  role: RoleDto,
  action: CreateRoleSetupAction,
  context: VerificationContext,
): boolean {
  const bodyId = resolveBodyReference(action.bodyRef, context);
  return (
    role.roleType === action.roleType &&
    role.active === action.active &&
    (!bodyId || role.bodyId === bodyId) &&
    (!action.metadataUri || role.metadataUri === action.metadataUri)
  );
}

function mandateMatchesMandateAction(
  mandate: MandateDto,
  action: AssignMandateSetupAction,
  context: VerificationContext,
): boolean {
  const roleId = resolveRoleReference(action.roleRef, context);
  return (
    (!roleId || mandate.roleId === roleId) &&
    sameAddress(mandate.holderAddress, action.holderAddress) &&
    mandate.startTime === action.startTime &&
    mandate.endTime === action.endTime &&
    mandate.proposalTypeMask === action.proposalTypeMask &&
    mandate.spendingLimit === action.spendingLimit &&
    mandate.active &&
    !mandate.revoked
  );
}

function policyMatchesPolicyAction(
  policy: OrganizationPolicyDto,
  action: SetPolicyRuleSetupAction,
  context: VerificationContext,
): boolean {
  const expectedOrgId = resolveOrganizationReference(
    action.organizationRef,
    context,
  );
  const requiredApprovalBodies = resolvePolicyBodyReferences(
    action.requiredApprovalBodies,
    context,
  );
  const vetoBodies = resolvePolicyBodyReferences(action.vetoBodies, context);
  const executorBody = action.executorBody
    ? resolveBodyReference(action.executorBody, context)
    : undefined;

  if (!requiredApprovalBodies || !vetoBodies) {
    return false;
  }

  if (action.executorBody && !executorBody) {
    return false;
  }

  return (
    (!expectedOrgId || policy.orgId === expectedOrgId) &&
    policy.proposalType === action.proposalType &&
    sameStringArray(policy.requiredApprovalBodies, requiredApprovalBodies) &&
    sameStringArray(policy.vetoBodies, vetoBodies) &&
    (policy.executorBody ?? "0") === (executorBody ?? "0") &&
    policy.timelockSeconds === action.timelockSeconds &&
    policy.enabled === action.enabled
  );
}

function resolveOrganizationReference(
  reference: SetupEntityReference,
  context: VerificationContext,
): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  if (
    reference.draftId &&
    context.draft.organization?.draftId === reference.draftId
  ) {
    return (
      context.draft.organization.orgId ??
      context.executionState?.resolvedOrgId ??
      context.organization?.orgId ??
      context.readModels?.organization?.orgId
    );
  }

  return (
    context.executionState?.resolvedOrgId ??
    context.organization?.orgId ??
    context.readModels?.organization?.orgId
  );
}

function resolveBodyReference(
  reference: SetupEntityReference,
  context: VerificationContext,
): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  const bodyAction = reference.draftId
    ? context.bodyActions.find(
        (action) => action.bodyDraftId === reference.draftId,
      )
    : undefined;
  if (!bodyAction) {
    return undefined;
  }

  return (
    context.bodyByActionId.get(bodyAction.actionId)?.bodyId ??
    context.executionState?.resolvedBodyIds[bodyAction.actionId] ??
    bodyAction.bodyId
  );
}

function resolveRoleReference(
  reference: SetupEntityReference,
  context: VerificationContext,
): string | undefined {
  if (reference.indexedId) {
    return reference.indexedId;
  }

  const roleAction = reference.draftId
    ? context.roleActions.find(
        (action) => action.roleDraftId === reference.draftId,
      )
    : undefined;
  if (!roleAction) {
    return undefined;
  }

  return (
    context.roleByActionId.get(roleAction.actionId)?.roleId ??
    context.executionState?.resolvedRoleIds[roleAction.actionId] ??
    roleAction.roleId
  );
}

function resolvePolicyBodyReferences(
  references: readonly SetupEntityReference[],
  context: VerificationContext,
): readonly string[] | undefined {
  const resolved = references.map((reference) =>
    resolveBodyReference(reference, context),
  );
  return resolved.every((bodyId): bodyId is string => Boolean(bodyId))
    ? resolved
    : undefined;
}

function getUnresolvedDependencies(
  action: SetupAction,
  context: VerificationContext,
): readonly SetupCompletionDependencyIssue[] {
  const dependencyIds = getCompletionDependencyActionIds(action, context);
  return dependencyIds.flatMap((dependencyActionId) => {
    const dependency = context.draft.actions.find(
      (candidate) => candidate.actionId === dependencyActionId,
    );
    const dependencyResult = context.resultByActionId.get(dependencyActionId);
    if (dependencyResult?.state === "indexed") {
      return [];
    }

    return [
      {
        actionId: action.actionId,
        actionKind: action.kind,
        dependencyActionId,
        dependencyLabel: dependency?.label ?? dependencyActionId,
        label: action.label,
        message: `${action.label} is waiting for ${dependency?.label ?? dependencyActionId} to be indexed.`,
      },
    ];
  });
}

function getBlockedDependency(
  action: SetupAction,
  context: VerificationContext,
): SetupCompletionDependencyIssue | undefined {
  return getCompletionDependencyActionIds(action, context)
    .map((dependencyActionId) => {
      const dependency = context.draft.actions.find(
        (candidate) => candidate.actionId === dependencyActionId,
      );
      const dependencyResult = context.resultByActionId.get(dependencyActionId);
      if (
        dependencyResult?.state !== "failed" &&
        dependencyResult?.state !== "blocked"
      ) {
        return undefined;
      }

      return {
        actionId: action.actionId,
        actionKind: action.kind,
        dependencyActionId,
        dependencyLabel: dependency?.label ?? dependencyActionId,
        label: action.label,
        message: `${action.label} is blocked by ${dependency?.label ?? dependencyActionId}.`,
      };
    })
    .find((issue): issue is SetupCompletionDependencyIssue => Boolean(issue));
}

function getCompletionDependencyActionIds(
  action: SetupAction,
  context: VerificationContext,
): readonly string[] {
  if (action.kind !== SetupActionKind.SetPolicyRule) {
    return action.dependsOn;
  }

  const dependencyIds = new Set(action.dependsOn);
  getPolicyMandateDependencies(action, context).forEach((mandate) => {
    dependencyIds.add(mandate.actionId);
  });
  return [...dependencyIds];
}

function getPolicyMandateDependencies(
  policy: SetPolicyRuleSetupAction,
  context: VerificationContext,
): readonly AssignMandateSetupAction[] {
  const dependencyIds = new Set(policy.dependsOn);
  const dependentRoles = context.roleActions.filter((role) =>
    dependencyIds.has(role.actionId),
  );

  return context.mandateActions.filter(
    (mandate) =>
      dependencyIds.has(mandate.actionId) ||
      dependentRoles.some((role) => mandateTargetsRole(mandate, role)),
  );
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

function shouldReportMissingIndexedEntity(
  action: SetupAction,
  context: VerificationContext,
): boolean {
  if (action.kind === SetupActionKind.CreateOrganization) {
    const transaction = context.executionState?.createOrganization;
    return Boolean(action.orgId ?? transaction?.orgId);
  }

  if (action.kind === SetupActionKind.SetPolicyRule) {
    return false;
  }

  return hasResolvedDependencies(action, context);
}

function hasResolvedDependencies(
  action: SetupAction,
  context: VerificationContext,
): boolean {
  return getCompletionDependencyActionIds(action, context).every(
    (dependencyActionId) =>
      context.resultByActionId.get(dependencyActionId)?.state === "indexed",
  );
}

function getMissingEntityMessage(action: SetupAction): string {
  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return "The expected organization was not found in the indexed organization read model.";
    case SetupActionKind.CreateBody:
      return "No indexed body matches the draft body kind, active state, and resolved organization.";
    case SetupActionKind.CreateRole:
      return "No indexed role matches the draft role type and resolved body.";
    case SetupActionKind.AssignMandate:
      return "No indexed active mandate matches the draft holder, role, scope, and spending limit.";
    case SetupActionKind.SetPolicyRule:
      return "No indexed policy rule matches this draft route.";
  }
}

function getMissingPolicyMessage(
  action: SetPolicyRuleSetupAction,
  context: VerificationContext,
): string {
  const requiredApprovalBodies = resolvePolicyBodyReferences(
    action.requiredApprovalBodies,
    context,
  );
  const vetoBodies = resolvePolicyBodyReferences(action.vetoBodies, context);
  const executorBody = action.executorBody
    ? resolveBodyReference(action.executorBody, context)
    : undefined;

  if (!requiredApprovalBodies) {
    return "Policy verification is waiting for every required approval body to resolve to an indexed bodyId.";
  }

  if (!vetoBodies) {
    return "Policy verification is waiting for every veto body to resolve to an indexed bodyId.";
  }

  if (action.executorBody && !executorBody) {
    return "Policy verification is waiting for the executor body to resolve to an indexed bodyId.";
  }

  return `No indexed ${formatProposalType(action.proposalType)} policy rule matches the resolved approval, veto, executor, timelock, and enabled values.`;
}

function indexedResult(
  action: SetupAction,
  transaction: SetupActionTransaction | undefined,
  result: InternalActionVerification,
): InternalActionVerification {
  return {
    ...result,
    txHash: transaction?.txHash ?? result.txHash,
  };
}

function baseIndexedResult(
  action: SetupAction,
  transaction: SetupActionTransaction | undefined,
  message: string,
  indexedEntityId: string,
): InternalActionVerification {
  return {
    actionId: action.actionId,
    indexedEntityId,
    kind: action.kind,
    label: action.label,
    message,
    state: "indexed",
    txHash: transaction?.txHash,
    unresolvedDependencies: [],
  };
}

function issueResult({
  action,
  message,
  state,
  transaction,
}: {
  readonly action: SetupAction;
  readonly message: string;
  readonly state: SetupCompletionActionState;
  readonly transaction?: SetupActionTransaction;
}): InternalActionVerification {
  return {
    actionId: action.actionId,
    kind: action.kind,
    label: action.label,
    message,
    state,
    txHash: transaction?.txHash,
    unresolvedDependencies: [],
  };
}

function buildIndexedReadModelSource(
  executionState: SetupDraftExecutionState | undefined,
  readModels: SetupCompletionReadModels | undefined,
): IndexedReadModelSource {
  return {
    bodies: uniqueBy(
      [
        ...Object.values(executionState?.resolvedBodies ?? {}),
        ...(readModels?.bodies ?? []),
      ],
      (body) => `${body.orgId}:${body.bodyId}`,
    ),
    mandates: uniqueBy(
      [
        ...Object.values(executionState?.resolvedMandates ?? {}),
        ...(readModels?.mandates ?? []),
      ],
      (mandate) => `${mandate.orgId}:${mandate.mandateId}`,
    ),
    organizations: uniqueBy(
      [
        ...(executionState?.resolvedOrganization
          ? [executionState.resolvedOrganization]
          : []),
        ...(readModels?.organization ? [readModels.organization] : []),
      ],
      (organization) => organization.orgId,
    ),
    policies: uniqueBy(
      [
        ...Object.values(executionState?.resolvedPolicies ?? {}),
        ...(readModels?.policies ?? []),
      ],
      (policy) => `${policy.orgId}:${policy.proposalType}:${policy.version}`,
    ),
    roles: uniqueBy(
      [
        ...Object.values(executionState?.resolvedRoles ?? {}),
        ...(readModels?.roles ?? []),
      ],
      (role) => `${role.orgId}:${role.roleId}`,
    ),
  };
}

function getActionTransaction(
  action: SetupAction,
  state: SetupDraftExecutionState | undefined,
): SetupActionTransaction | undefined {
  if (!state) {
    return undefined;
  }

  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return state.createOrganization.actionId === action.actionId ||
        state.createOrganization.stage !== "idle"
        ? state.createOrganization
        : undefined;
    case SetupActionKind.CreateBody:
      return state.createBodies[action.actionId];
    case SetupActionKind.CreateRole:
      return state.createRoles[action.actionId];
    case SetupActionKind.AssignMandate:
      return state.assignMandates[action.actionId];
    case SetupActionKind.SetPolicyRule:
      return state.setPolicyRules[action.actionId];
  }
}

function isInProgressStage(stage: SetupActionLifecycleStage): boolean {
  return (
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "confirmed_waiting_indexer"
  );
}

function formatExecutionStage(stage: SetupActionLifecycleStage | "submitted"): string {
  return stage.replace(/_/g, " ");
}

function deriveCompletionReadiness({
  blockedActions,
  failedActions,
  indexedActions,
  inProgressActions,
  missingIndexedEntities,
  totalActions,
  unresolvedPolicyRules,
}: {
  readonly blockedActions: number;
  readonly failedActions: number;
  readonly indexedActions: number;
  readonly inProgressActions: number;
  readonly missingIndexedEntities: number;
  readonly totalActions: number;
  readonly unresolvedPolicyRules: number;
}): SetupCompletionReadiness {
  if (totalActions === 0) {
    return "not_started";
  }

  if (indexedActions === totalActions) {
    return "completed";
  }

  if (failedActions > 0 || blockedActions > 0) {
    return "blocked";
  }

  if (inProgressActions > 0) {
    return "in_progress";
  }

  if (
    indexedActions > 0 ||
    missingIndexedEntities > 0 ||
    unresolvedPolicyRules > 0
  ) {
    return "partially_indexed";
  }

  return "not_started";
}

function resolveIndexedOrgId(
  context: VerificationContext,
): string | undefined {
  return (
    context.organization?.orgId ??
    context.executionState?.resolvedOrgId ??
    context.draft.organization?.orgId ??
    context.readModels?.organization?.orgId
  );
}

function stripInternalResult(
  result: InternalActionVerification,
): SetupCompletionActionVerification {
  return {
    actionId: result.actionId,
    indexedEntityId: result.indexedEntityId,
    kind: result.kind,
    label: result.label,
    message: result.message,
    state: result.state,
    txHash: result.txHash,
    unresolvedDependencies: result.unresolvedDependencies,
  };
}

function toIssues(
  results: readonly SetupCompletionActionVerification[],
): readonly SetupCompletionIssue[] {
  return results.map((result) => ({
    actionId: result.actionId,
    actionKind: result.kind,
    label: result.label,
    message: result.message,
  }));
}

function countByState(
  results: readonly SetupCompletionActionVerification[],
  state: SetupCompletionActionState,
): number {
  return results.filter((result) => result.state === state).length;
}

function uniqueBy<TValue>(
  values: readonly TValue[],
  getKey: (value: TValue) => string,
): readonly TValue[] {
  const seen = new Set<string>();
  const unique: TValue[] = [];
  values.forEach((value) => {
    const key = getKey(value);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(value);
  });
  return unique;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function formatProposalType(value: string): string {
  return value.replace(/_/g, " ");
}

function isCreateBodyAction(action: SetupAction): action is CreateBodySetupAction {
  return action.kind === SetupActionKind.CreateBody;
}

function isCreateRoleAction(action: SetupAction): action is CreateRoleSetupAction {
  return action.kind === SetupActionKind.CreateRole;
}

function isAssignMandateAction(
  action: SetupAction,
): action is AssignMandateSetupAction {
  return action.kind === SetupActionKind.AssignMandate;
}
