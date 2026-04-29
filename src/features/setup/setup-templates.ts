import type {
  Address,
  ChainId,
  CreateBodySetupAction,
  CreateOrganizationSetupAction,
  CreateRoleSetupAction,
  JsonObject,
  NumericString,
  SetPolicyRuleSetupAction,
  SetupAction,
  SetupDraft,
  SetupEntityReference,
  SetupValidationWarning,
  TemplateDescriptor,
} from "@isonia/types";
import {
  BodyKind,
  ProposalType,
  RoleType,
  SetupActionExecutionStatus,
  SetupActionKind,
  SetupDraftStatus,
  SetupValidationWarningCode,
} from "@isonia/types";

export const SIMPLE_DAO_PLUS_TEMPLATE_ID = "simple-dao-plus";
const SIMPLE_DAO_PLUS_VERSION = "0.5.0-alpha";
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

interface SetupDraftOptions {
  readonly chainId: ChainId;
  readonly govCoreAddress: Address;
  readonly orgId?: NumericString;
}

interface DraftBodyDefinition {
  readonly bodyDraftId: string;
  readonly actionId: string;
  readonly kind: BodyKind;
  readonly fallbackName: string;
  readonly description: string;
}

interface DraftRoleDefinition {
  readonly roleDraftId: string;
  readonly actionId: string;
  readonly bodyDraftId: string;
  readonly roleType: RoleType;
  readonly fallbackName: string;
}

const ORGANIZATION_DRAFT_ID = "simple-dao-plus-organization";
const CREATE_ORGANIZATION_ACTION_ID = "create-organization";

const SIMPLE_DAO_PLUS_BODIES: readonly DraftBodyDefinition[] = [
  {
    actionId: "create-general-council",
    bodyDraftId: "body-general-council",
    description: "General organization approval and standard proposal review.",
    fallbackName: "General Council",
    kind: BodyKind.GeneralCouncil,
  },
  {
    actionId: "create-treasury-committee",
    bodyDraftId: "body-treasury-committee",
    description: "Treasury proposal approval and treasury-specific review.",
    fallbackName: "Treasury Committee",
    kind: BodyKind.TreasuryCommittee,
  },
  {
    actionId: "create-security-council",
    bodyDraftId: "body-security-council",
    description: "Veto coverage and emergency authority.",
    fallbackName: "Security Council",
    kind: BodyKind.SecurityCouncil,
  },
];

const SIMPLE_DAO_PLUS_ROLES: readonly DraftRoleDefinition[] = [
  {
    actionId: "create-general-body-admin",
    bodyDraftId: "body-general-council",
    fallbackName: "General Council Body Admin",
    roleDraftId: "role-general-body-admin",
    roleType: RoleType.BodyAdmin,
  },
  {
    actionId: "create-general-proposer",
    bodyDraftId: "body-general-council",
    fallbackName: "General Council Proposer",
    roleDraftId: "role-general-proposer",
    roleType: RoleType.Proposer,
  },
  {
    actionId: "create-general-approver",
    bodyDraftId: "body-general-council",
    fallbackName: "General Council Approver",
    roleDraftId: "role-general-approver",
    roleType: RoleType.Approver,
  },
  {
    actionId: "create-treasury-approver",
    bodyDraftId: "body-treasury-committee",
    fallbackName: "Treasury Committee Approver",
    roleDraftId: "role-treasury-approver",
    roleType: RoleType.Approver,
  },
  {
    actionId: "create-treasury-executor",
    bodyDraftId: "body-treasury-committee",
    fallbackName: "Treasury Committee Executor",
    roleDraftId: "role-treasury-executor",
    roleType: RoleType.Executor,
  },
  {
    actionId: "create-security-vetoer",
    bodyDraftId: "body-security-council",
    fallbackName: "Security Council Vetoer",
    roleDraftId: "role-security-vetoer",
    roleType: RoleType.Vetoer,
  },
  {
    actionId: "create-security-emergency-operator",
    bodyDraftId: "body-security-council",
    fallbackName: "Security Council Emergency Operator",
    roleDraftId: "role-security-emergency-operator",
    roleType: RoleType.EmergencyOperator,
  },
];

export const SIMPLE_DAO_PLUS_TEMPLATE: TemplateDescriptor = {
  actionFactoryId: "app-core.simple-dao-plus.v0_5",
  defaults: {
    inputValues: {
      emergencyTimelockSeconds: 0,
      standardTimelockSeconds: 3600,
      treasuryTimelockSeconds: 86400,
      upgradeTimelockSeconds: 86400,
    } satisfies JsonObject,
  },
  description:
    "A general council, treasury committee, and security council with explicit approval, execution, and veto coverage.",
  inputs: [
    {
      inputId: "organizationName",
      kind: "text",
      label: "Organization name",
      placeholder: "Acme Governance",
      required: true,
    },
    {
      inputId: "organizationMetadataUri",
      kind: "text",
      label: "Metadata URI",
      placeholder: "ipfs://...",
      required: false,
    },
    {
      defaultValue: ZERO_ADDRESS,
      inputId: "organizationAdminAddress",
      kind: "address",
      label: "Organization admin",
      required: true,
    },
  ],
  name: "Simple DAO+",
  summary:
    "General approval, treasury-specific review, security veto coverage, and explicit executor authority.",
  supportedChains: undefined,
  templateId: SIMPLE_DAO_PLUS_TEMPLATE_ID,
  version: SIMPLE_DAO_PLUS_VERSION,
  warnings: [],
};

export const SETUP_TEMPLATES: readonly TemplateDescriptor[] = [
  SIMPLE_DAO_PLUS_TEMPLATE,
  {
    actionFactoryId: "app-core.bicameral-council.v0_5",
    defaults: { inputValues: {} },
    inputs: [],
    name: "Bicameral Council",
    summary: "Two approval bodies with emergency veto coverage.",
    templateId: "bicameral-council",
    version: SIMPLE_DAO_PLUS_VERSION,
    warnings: [],
  },
  {
    actionFactoryId: "app-core.security-gated-operations.v0_5",
    defaults: { inputValues: {} },
    inputs: [],
    name: "Security-Gated Operations",
    summary: "Normal approval with narrow emergency and veto authority.",
    templateId: "security-gated-operations",
    version: SIMPLE_DAO_PLUS_VERSION,
    warnings: [],
  },
];

export function createSimpleDaoPlusDraft({
  chainId,
  govCoreAddress,
  orgId,
}: SetupDraftOptions): SetupDraft {
  const createdAt = new Date().toISOString();
  const organizationRef: SetupEntityReference = orgId
    ? { indexedId: orgId }
    : { draftId: ORGANIZATION_DRAFT_ID };
  const warnings = createDraftWarnings();

  return {
    actions: [
      ...createOrganizationActions({ chainId, govCoreAddress, orgId }),
      ...createBodyActions({ chainId, govCoreAddress, organizationRef, orgId }),
      ...createRoleActions({ chainId, govCoreAddress }),
      ...createMandateActions({ chainId, govCoreAddress }),
      ...createPolicyActions({ chainId, govCoreAddress, organizationRef }),
    ],
    chainId,
    createdAt,
    draftId: orgId
      ? `${SIMPLE_DAO_PLUS_TEMPLATE_ID}-org-${orgId}`
      : `${SIMPLE_DAO_PLUS_TEMPLATE_ID}-new`,
    organization: {
      adminAddress: orgId ? undefined : ZERO_ADDRESS,
      draftId: ORGANIZATION_DRAFT_ID,
      fallbackName: orgId ? `Organization #${orgId}` : "New organization",
      orgId,
    },
    status: SetupDraftStatus.Editing,
    templateId: SIMPLE_DAO_PLUS_TEMPLATE.templateId,
    templateVersion: SIMPLE_DAO_PLUS_TEMPLATE.version,
    updatedAt: createdAt,
    warnings,
  };
}

function createOrganizationActions({
  chainId,
  govCoreAddress,
  orgId,
}: SetupDraftOptions): readonly CreateOrganizationSetupAction[] {
  if (orgId) {
    return [];
  }

  return [
    {
      actionId: CREATE_ORGANIZATION_ACTION_ID,
      adminAddress: ZERO_ADDRESS,
      dependsOn: [],
      description:
        "Create the protocol organization root before topology setup begins.",
      executionStatus: SetupActionExecutionStatus.Draft,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      fallbackName: "New organization",
      kind: SetupActionKind.CreateOrganization,
      label: "Create organization",
      organizationDraftId: ORGANIZATION_DRAFT_ID,
      requiredSignerAddress: ZERO_ADDRESS,
      warnings: [],
    },
  ];
}

function createBodyActions({
  chainId,
  govCoreAddress,
  organizationRef,
  orgId,
}: SetupDraftOptions & {
  readonly organizationRef: SetupEntityReference;
}): readonly CreateBodySetupAction[] {
  return SIMPLE_DAO_PLUS_BODIES.map((body) => ({
    actionId: body.actionId,
    active: true,
    bodyDraftId: body.bodyDraftId,
    bodyKind: body.kind,
    dependsOn: orgId ? [] : [CREATE_ORGANIZATION_ACTION_ID],
    description: body.description,
    executionStatus: SetupActionExecutionStatus.Draft,
    expectedChainId: chainId,
    expectedContractAddress: govCoreAddress,
    fallbackName: body.fallbackName,
    kind: SetupActionKind.CreateBody,
    label: `Create ${body.fallbackName}`,
    organizationRef,
    warnings: [],
  }));
}

function createRoleActions({
  chainId,
  govCoreAddress,
}: SetupDraftOptions): readonly CreateRoleSetupAction[] {
  return SIMPLE_DAO_PLUS_ROLES.map((role) => ({
    actionId: role.actionId,
    active: true,
    bodyRef: { draftId: role.bodyDraftId },
    dependsOn: [getBodyActionId(role.bodyDraftId)],
    executionStatus: SetupActionExecutionStatus.Draft,
    expectedChainId: chainId,
    expectedContractAddress: govCoreAddress,
    fallbackName: role.fallbackName,
    kind: SetupActionKind.CreateRole,
    label: `Create ${role.fallbackName}`,
    roleDraftId: role.roleDraftId,
    roleType: role.roleType,
    warnings: [],
  }));
}

function createMandateActions({
  chainId,
  govCoreAddress,
}: SetupDraftOptions): readonly SetupAction[] {
  return SIMPLE_DAO_PLUS_ROLES.map((role) => ({
    actionId: `assign-${role.roleDraftId}`,
    dependsOn: [role.actionId],
    description: "Placeholder holder assignment for draft review.",
    endTime: "0",
    executionStatus: SetupActionExecutionStatus.Draft,
    expectedChainId: chainId,
    expectedContractAddress: govCoreAddress,
    holderAddress: ZERO_ADDRESS,
    kind: SetupActionKind.AssignMandate,
    label: `Assign ${role.fallbackName}`,
    mandateDraftId: `mandate-${role.roleDraftId}`,
    proposalTypeMask: getProposalTypeMaskForRole(role.roleType),
    proposalTypes: getProposalTypesForRole(role.roleType),
    roleRef: { draftId: role.roleDraftId },
    spendingLimit: "0",
    startTime: "0",
    warnings: [],
  }));
}

function createPolicyActions({
  chainId,
  govCoreAddress,
  organizationRef,
}: SetupDraftOptions & {
  readonly organizationRef: SetupEntityReference;
}): readonly SetPolicyRuleSetupAction[] {
  const general = { draftId: "body-general-council" };
  const treasury = { draftId: "body-treasury-committee" };
  const security = { draftId: "body-security-council" };

  return [
    {
      actionId: "set-policy-standard",
      dependsOn: [
        "create-general-council",
        "create-security-council",
        "create-general-approver",
        "create-security-vetoer",
      ],
      enabled: true,
      executionStatus: SetupActionExecutionStatus.Draft,
      executorBody: general,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      kind: SetupActionKind.SetPolicyRule,
      label: "Set standard policy route",
      organizationRef,
      proposalType: ProposalType.Standard,
      requiredApprovalBodies: [general],
      timelockSeconds: "3600",
      vetoBodies: [security],
      warnings: [],
    },
    {
      actionId: "set-policy-treasury",
      dependsOn: [
        "create-general-council",
        "create-treasury-committee",
        "create-security-council",
        "create-treasury-approver",
        "create-treasury-executor",
        "create-security-vetoer",
      ],
      enabled: true,
      executionStatus: SetupActionExecutionStatus.Draft,
      executorBody: treasury,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      kind: SetupActionKind.SetPolicyRule,
      label: "Set treasury policy route",
      organizationRef,
      proposalType: ProposalType.Treasury,
      requiredApprovalBodies: [general, treasury],
      timelockSeconds: "86400",
      vetoBodies: [security],
      warnings: [],
    },
    {
      actionId: "set-policy-upgrade",
      dependsOn: [
        "create-general-council",
        "create-security-council",
        "create-general-approver",
        "create-security-vetoer",
      ],
      enabled: true,
      executionStatus: SetupActionExecutionStatus.Draft,
      executorBody: general,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      kind: SetupActionKind.SetPolicyRule,
      label: "Set upgrade policy route",
      organizationRef,
      proposalType: ProposalType.Upgrade,
      requiredApprovalBodies: [general],
      timelockSeconds: "86400",
      vetoBodies: [security],
      warnings: [],
    },
    {
      actionId: "set-policy-emergency",
      dependsOn: [
        "create-security-council",
        "create-security-vetoer",
        "create-security-emergency-operator",
      ],
      enabled: true,
      executionStatus: SetupActionExecutionStatus.Draft,
      executorBody: security,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      kind: SetupActionKind.SetPolicyRule,
      label: "Set emergency policy route",
      organizationRef,
      proposalType: ProposalType.Emergency,
      requiredApprovalBodies: [security],
      timelockSeconds: "0",
      vetoBodies: [security],
      warnings: [],
    },
  ];
}

function createDraftWarnings(): readonly SetupValidationWarning[] {
  return [
    {
      code: SetupValidationWarningCode.PolicyRouteWithoutEligibleHolder,
      message:
        "This skeleton draft uses placeholder holder addresses. Add real mandate holders before any setup transaction flow is enabled.",
      severity: "warning",
    },
  ];
}

function getBodyActionId(bodyDraftId: string): string {
  const body = SIMPLE_DAO_PLUS_BODIES.find(
    (candidate) => candidate.bodyDraftId === bodyDraftId,
  );
  return body?.actionId ?? bodyDraftId;
}

function getProposalTypesForRole(roleType: RoleType): readonly ProposalType[] {
  if (roleType === RoleType.Vetoer || roleType === RoleType.EmergencyOperator) {
    return [
      ProposalType.Emergency,
      ProposalType.Standard,
      ProposalType.Treasury,
      ProposalType.Upgrade,
    ];
  }

  if (roleType === RoleType.Executor) {
    return [ProposalType.Treasury];
  }

  return [ProposalType.Standard, ProposalType.Treasury, ProposalType.Upgrade];
}

function getProposalTypeMaskForRole(roleType: RoleType): NumericString {
  return getProposalTypesForRole(roleType)
    .reduce((mask, proposalType) => mask | proposalTypeMaskBit(proposalType), 0n)
    .toString();
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
