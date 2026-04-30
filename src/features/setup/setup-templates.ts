import type {
  Address,
  AssignMandateSetupAction,
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
  TemplateDescriptor,
} from "@isonia/types";
import {
  BodyKind,
  ProposalType,
  RoleType,
  SetupActionExecutionStatus,
  SetupActionKind,
  SetupDraftStatus,
} from "@isonia/types";
import { applySetupValidation } from "./setup-validation";

export const SIMPLE_DAO_PLUS_TEMPLATE_ID = "simple-dao-plus";

export type SimpleDaoPlusExecutorBodyChoice =
  | "general_council"
  | "treasury_committee";

export interface SimpleDaoPlusDraftInputs {
  readonly organizationName: string;
  readonly organizationMetadataUri: string;
  readonly organizationAdminAddress: string;
  readonly generalCouncilHolderAddresses: readonly string[];
  readonly treasuryCommitteeHolderAddresses: readonly string[];
  readonly securityCouncilHolderAddresses: readonly string[];
  readonly executorHolderAddress: string;
  readonly executorBodyChoice: SimpleDaoPlusExecutorBodyChoice;
  readonly standardTimelockSeconds: string;
  readonly treasuryTimelockSeconds: string;
  readonly upgradeTimelockSeconds: string;
  readonly emergencyTimelockSeconds: string;
}

const SIMPLE_DAO_PLUS_VERSION = "0.5.0-alpha";
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

const DEFAULT_STANDARD_TIMELOCK_SECONDS = "3600";
const DEFAULT_TREASURY_TIMELOCK_SECONDS = "86400";
const DEFAULT_UPGRADE_TIMELOCK_SECONDS = "86400";
const DEFAULT_EMERGENCY_TIMELOCK_SECONDS = "0";

export const DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS: SimpleDaoPlusDraftInputs = {
  emergencyTimelockSeconds: DEFAULT_EMERGENCY_TIMELOCK_SECONDS,
  executorBodyChoice: "treasury_committee",
  executorHolderAddress: "",
  generalCouncilHolderAddresses: [],
  organizationAdminAddress: "",
  organizationMetadataUri: "",
  organizationName: "",
  securityCouncilHolderAddresses: [],
  standardTimelockSeconds: DEFAULT_STANDARD_TIMELOCK_SECONDS,
  treasuryCommitteeHolderAddresses: [],
  treasuryTimelockSeconds: DEFAULT_TREASURY_TIMELOCK_SECONDS,
  upgradeTimelockSeconds: DEFAULT_UPGRADE_TIMELOCK_SECONDS,
};

interface SetupDraftOptions {
  readonly chainId: ChainId;
  readonly govCoreAddress: Address;
  readonly inputs?: Partial<SimpleDaoPlusDraftInputs>;
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
  readonly proposalTypes: readonly ProposalType[];
}

const ORGANIZATION_DRAFT_ID = "simple-dao-plus-organization";
const CREATE_ORGANIZATION_ACTION_ID = "create-organization";

const BODY_DRAFT_IDS = {
  general: "body-general-council",
  security: "body-security-council",
  treasury: "body-treasury-committee",
} as const;

const ROLE_DRAFT_IDS = {
  generalApprover: "role-general-approver",
  generalBodyAdmin: "role-general-body-admin",
  generalExecutor: "role-general-executor",
  generalProposer: "role-general-proposer",
  securityApprover: "role-security-approver",
  securityEmergencyOperator: "role-security-emergency-operator",
  securityExecutor: "role-security-executor",
  securityVetoer: "role-security-vetoer",
  treasuryApprover: "role-treasury-approver",
  treasuryExecutor: "role-treasury-executor",
} as const;

const GENERAL_PROPOSAL_TYPES = [
  ProposalType.Standard,
  ProposalType.Treasury,
  ProposalType.Upgrade,
] as const;

const ALL_PROPOSAL_TYPES = [
  ProposalType.Standard,
  ProposalType.Treasury,
  ProposalType.Upgrade,
  ProposalType.Emergency,
] as const;

const SIMPLE_DAO_PLUS_BODIES: readonly DraftBodyDefinition[] = [
  {
    actionId: "create-general-council",
    bodyDraftId: BODY_DRAFT_IDS.general,
    description: "General organization approval and standard proposal review.",
    fallbackName: "General Council",
    kind: BodyKind.GeneralCouncil,
  },
  {
    actionId: "create-treasury-committee",
    bodyDraftId: BODY_DRAFT_IDS.treasury,
    description: "Treasury proposal approval and treasury-specific review.",
    fallbackName: "Treasury Committee",
    kind: BodyKind.TreasuryCommittee,
  },
  {
    actionId: "create-security-council",
    bodyDraftId: BODY_DRAFT_IDS.security,
    description: "Veto coverage and emergency authority.",
    fallbackName: "Security Council",
    kind: BodyKind.SecurityCouncil,
  },
];

export const SIMPLE_DAO_PLUS_TEMPLATE: TemplateDescriptor = {
  actionFactoryId: "app-core.simple-dao-plus.v0_5",
  defaults: {
    inputValues: {
      emergencyTimelockSeconds: DEFAULT_EMERGENCY_TIMELOCK_SECONDS,
      executorBodyChoice: DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.executorBodyChoice,
      executorHolderAddress: "",
      generalCouncilHolderAddresses: [],
      organizationAdminAddress: "",
      organizationMetadataUri: "",
      organizationName: "",
      securityCouncilHolderAddresses: [],
      standardTimelockSeconds: DEFAULT_STANDARD_TIMELOCK_SECONDS,
      treasuryCommitteeHolderAddresses: [],
      treasuryTimelockSeconds: DEFAULT_TREASURY_TIMELOCK_SECONDS,
      upgradeTimelockSeconds: DEFAULT_UPGRADE_TIMELOCK_SECONDS,
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
      inputId: "organizationAdminAddress",
      kind: "address",
      label: "Organization admin",
      required: true,
    },
    {
      description: "Addresses that receive General Council BodyAdmin, Proposer, and Approver mandates.",
      inputId: "generalCouncilHolderAddresses",
      kind: "address_list",
      label: "General Council holders",
      required: true,
    },
    {
      description: "Addresses that receive Treasury Committee Approver mandates.",
      inputId: "treasuryCommitteeHolderAddresses",
      kind: "address_list",
      label: "Treasury Committee holders",
      required: true,
    },
    {
      description: "Addresses that receive Security Council Approver, Vetoer, and EmergencyOperator mandates.",
      inputId: "securityCouncilHolderAddresses",
      kind: "address_list",
      label: "Security Council holders",
      required: true,
    },
    {
      description: "Address that receives Executor mandates for the configured executor bodies.",
      inputId: "executorHolderAddress",
      kind: "address",
      label: "Executor holder",
      required: true,
    },
    {
      defaultValue: DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.executorBodyChoice,
      inputId: "executorBodyChoice",
      kind: "text",
      label: "Standard and upgrade executor body",
      options: [
        {
          description: "The Treasury Committee executor role executes standard, treasury, and upgrade routes.",
          label: "Treasury Committee",
          value: "treasury_committee",
        },
        {
          description: "The General Council executor role executes standard and upgrade routes.",
          label: "General Council",
          value: "general_council",
        },
      ],
      required: true,
    },
    {
      defaultValue: Number(DEFAULT_STANDARD_TIMELOCK_SECONDS),
      inputId: "standardTimelockSeconds",
      kind: "timelock_seconds",
      label: "Standard timelock",
      required: true,
    },
    {
      defaultValue: Number(DEFAULT_TREASURY_TIMELOCK_SECONDS),
      inputId: "treasuryTimelockSeconds",
      kind: "timelock_seconds",
      label: "Treasury timelock",
      required: true,
    },
    {
      defaultValue: Number(DEFAULT_UPGRADE_TIMELOCK_SECONDS),
      inputId: "upgradeTimelockSeconds",
      kind: "timelock_seconds",
      label: "Upgrade timelock",
      required: true,
    },
    {
      defaultValue: Number(DEFAULT_EMERGENCY_TIMELOCK_SECONDS),
      inputId: "emergencyTimelockSeconds",
      kind: "timelock_seconds",
      label: "Emergency timelock",
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
  inputs,
  orgId,
}: SetupDraftOptions): SetupDraft {
  const createdAt = new Date().toISOString();
  const normalizedInputs = normalizeSimpleDaoPlusInputs(inputs);
  const organizationName =
    normalizedInputs.organizationName || (orgId ? `Organization #${orgId}` : "New organization");
  const organizationRef: SetupEntityReference = orgId
    ? { indexedId: orgId }
    : { draftId: ORGANIZATION_DRAFT_ID };
  const adminAddress = maybeAddress(normalizedInputs.organizationAdminAddress);
  const roleDefinitions = createRoleDefinitions(normalizedInputs);
  const baseActions: readonly SetupAction[] = [
    ...createOrganizationActions({
      chainId,
      govCoreAddress,
      inputs: normalizedInputs,
      orgId,
    }),
    ...createBodyActions({
      adminAddress,
      chainId,
      govCoreAddress,
      organizationRef,
      orgId,
    }),
    ...createRoleActions({
      adminAddress,
      chainId,
      govCoreAddress,
      roleDefinitions,
    }),
    ...createMandateActions({
      adminAddress,
      chainId,
      govCoreAddress,
      inputs: normalizedInputs,
      roleDefinitions,
    }),
    ...createPolicyActions({
      adminAddress,
      chainId,
      govCoreAddress,
      inputs: normalizedInputs,
      organizationRef,
    }),
  ];
  return applySetupValidation({
    actions: baseActions,
    chainId,
    createdAt,
    draftId: orgId
      ? `${SIMPLE_DAO_PLUS_TEMPLATE_ID}-org-${orgId}`
      : `${SIMPLE_DAO_PLUS_TEMPLATE_ID}-new`,
    organization: {
      adminAddress,
      draftId: ORGANIZATION_DRAFT_ID,
      fallbackName: organizationName,
      metadataUri: optionalString(normalizedInputs.organizationMetadataUri),
      orgId,
    },
    status: SetupDraftStatus.Editing,
    templateId: SIMPLE_DAO_PLUS_TEMPLATE.templateId,
    templateVersion: SIMPLE_DAO_PLUS_TEMPLATE.version,
    updatedAt: createdAt,
    warnings: [],
  });
}

function normalizeSimpleDaoPlusInputs(
  inputs?: Partial<SimpleDaoPlusDraftInputs>,
): SimpleDaoPlusDraftInputs {
  const executorBodyChoice =
    inputs?.executorBodyChoice === "general_council" ||
    inputs?.executorBodyChoice === "treasury_committee"
      ? inputs.executorBodyChoice
      : DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.executorBodyChoice;

  return {
    emergencyTimelockSeconds: normalizeText(
      inputs?.emergencyTimelockSeconds,
      DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.emergencyTimelockSeconds,
    ),
    executorBodyChoice,
    executorHolderAddress: normalizeText(inputs?.executorHolderAddress, ""),
    generalCouncilHolderAddresses: normalizeAddressList(
      inputs?.generalCouncilHolderAddresses,
    ),
    organizationAdminAddress: normalizeText(
      inputs?.organizationAdminAddress,
      "",
    ),
    organizationMetadataUri: normalizeText(
      inputs?.organizationMetadataUri,
      "",
    ),
    organizationName: normalizeText(inputs?.organizationName, ""),
    securityCouncilHolderAddresses: normalizeAddressList(
      inputs?.securityCouncilHolderAddresses,
    ),
    standardTimelockSeconds: normalizeText(
      inputs?.standardTimelockSeconds,
      DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.standardTimelockSeconds,
    ),
    treasuryCommitteeHolderAddresses: normalizeAddressList(
      inputs?.treasuryCommitteeHolderAddresses,
    ),
    treasuryTimelockSeconds: normalizeText(
      inputs?.treasuryTimelockSeconds,
      DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.treasuryTimelockSeconds,
    ),
    upgradeTimelockSeconds: normalizeText(
      inputs?.upgradeTimelockSeconds,
      DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS.upgradeTimelockSeconds,
    ),
  };
}

function createRoleDefinitions(
  inputs: SimpleDaoPlusDraftInputs,
): readonly DraftRoleDefinition[] {
  const treasuryExecutorProposalTypes =
    inputs.executorBodyChoice === "treasury_committee"
      ? GENERAL_PROPOSAL_TYPES
      : [ProposalType.Treasury];

  return [
    {
      actionId: "create-general-body-admin",
      bodyDraftId: BODY_DRAFT_IDS.general,
      fallbackName: "General Council Body Admin",
      proposalTypes: GENERAL_PROPOSAL_TYPES,
      roleDraftId: ROLE_DRAFT_IDS.generalBodyAdmin,
      roleType: RoleType.BodyAdmin,
    },
    {
      actionId: "create-general-proposer",
      bodyDraftId: BODY_DRAFT_IDS.general,
      fallbackName: "General Council Proposer",
      proposalTypes: GENERAL_PROPOSAL_TYPES,
      roleDraftId: ROLE_DRAFT_IDS.generalProposer,
      roleType: RoleType.Proposer,
    },
    {
      actionId: "create-general-approver",
      bodyDraftId: BODY_DRAFT_IDS.general,
      fallbackName: "General Council Approver",
      proposalTypes: GENERAL_PROPOSAL_TYPES,
      roleDraftId: ROLE_DRAFT_IDS.generalApprover,
      roleType: RoleType.Approver,
    },
    ...(inputs.executorBodyChoice === "general_council"
      ? [
          {
            actionId: "create-general-executor",
            bodyDraftId: BODY_DRAFT_IDS.general,
            fallbackName: "General Council Executor",
            proposalTypes: [ProposalType.Standard, ProposalType.Upgrade],
            roleDraftId: ROLE_DRAFT_IDS.generalExecutor,
            roleType: RoleType.Executor,
          } satisfies DraftRoleDefinition,
        ]
      : []),
    {
      actionId: "create-treasury-approver",
      bodyDraftId: BODY_DRAFT_IDS.treasury,
      fallbackName: "Treasury Committee Approver",
      proposalTypes: [ProposalType.Treasury],
      roleDraftId: ROLE_DRAFT_IDS.treasuryApprover,
      roleType: RoleType.Approver,
    },
    {
      actionId: "create-treasury-executor",
      bodyDraftId: BODY_DRAFT_IDS.treasury,
      fallbackName: "Treasury Committee Executor",
      proposalTypes: treasuryExecutorProposalTypes,
      roleDraftId: ROLE_DRAFT_IDS.treasuryExecutor,
      roleType: RoleType.Executor,
    },
    {
      actionId: "create-security-approver",
      bodyDraftId: BODY_DRAFT_IDS.security,
      fallbackName: "Security Council Approver",
      proposalTypes: [ProposalType.Emergency],
      roleDraftId: ROLE_DRAFT_IDS.securityApprover,
      roleType: RoleType.Approver,
    },
    {
      actionId: "create-security-vetoer",
      bodyDraftId: BODY_DRAFT_IDS.security,
      fallbackName: "Security Council Vetoer",
      proposalTypes: ALL_PROPOSAL_TYPES,
      roleDraftId: ROLE_DRAFT_IDS.securityVetoer,
      roleType: RoleType.Vetoer,
    },
    {
      actionId: "create-security-executor",
      bodyDraftId: BODY_DRAFT_IDS.security,
      fallbackName: "Security Council Executor",
      proposalTypes: [ProposalType.Emergency],
      roleDraftId: ROLE_DRAFT_IDS.securityExecutor,
      roleType: RoleType.Executor,
    },
    {
      actionId: "create-security-emergency-operator",
      bodyDraftId: BODY_DRAFT_IDS.security,
      fallbackName: "Security Council Emergency Operator",
      proposalTypes: [ProposalType.Emergency],
      roleDraftId: ROLE_DRAFT_IDS.securityEmergencyOperator,
      roleType: RoleType.EmergencyOperator,
    },
  ];
}

function createOrganizationActions({
  chainId,
  govCoreAddress,
  inputs,
  orgId,
}: SetupDraftOptions & {
  readonly inputs: SimpleDaoPlusDraftInputs;
}): readonly CreateOrganizationSetupAction[] {
  if (orgId) {
    return [];
  }

  const adminAddress = maybeAddress(inputs.organizationAdminAddress);
  const fallbackName = inputs.organizationName || "New organization";

  return [
    {
      actionId: CREATE_ORGANIZATION_ACTION_ID,
      adminAddress: adminAddress ?? ZERO_ADDRESS,
      dependsOn: [],
      description:
        "Create the protocol organization root before topology setup begins.",
      executionStatus: SetupActionExecutionStatus.Draft,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      fallbackName,
      kind: SetupActionKind.CreateOrganization,
      label: "Create organization",
      metadataUri: optionalString(inputs.organizationMetadataUri),
      organizationDraftId: ORGANIZATION_DRAFT_ID,
      requiredSignerAddress: adminAddress,
      warnings: [],
    },
  ];
}

function createBodyActions({
  adminAddress,
  chainId,
  govCoreAddress,
  organizationRef,
  orgId,
}: SetupDraftOptions & {
  readonly adminAddress?: Address;
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
    requiredSignerAddress: adminAddress,
    warnings: [],
  }));
}

function createRoleActions({
  adminAddress,
  chainId,
  govCoreAddress,
  roleDefinitions,
}: SetupDraftOptions & {
  readonly adminAddress?: Address;
  readonly roleDefinitions: readonly DraftRoleDefinition[];
}): readonly CreateRoleSetupAction[] {
  return roleDefinitions.map((role) => ({
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
    requiredSignerAddress: adminAddress,
    roleDraftId: role.roleDraftId,
    roleType: role.roleType,
    warnings: [],
  }));
}

function createMandateActions({
  adminAddress,
  chainId,
  govCoreAddress,
  inputs,
  roleDefinitions,
}: SetupDraftOptions & {
  readonly adminAddress?: Address;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly roleDefinitions: readonly DraftRoleDefinition[];
}): readonly AssignMandateSetupAction[] {
  return roleDefinitions.flatMap((role) =>
    getHolderAddressesForRole(role, inputs).map((holderAddress, index) => ({
      actionId: `assign-${role.roleDraftId}-${sanitizeActionId(holderAddress)}-${index + 1}`,
      dependsOn: [role.actionId],
      description:
        "Assign a user-provided holder address to this draft role scope.",
      endTime: "0",
      executionStatus: SetupActionExecutionStatus.Draft,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      holderAddress: holderAddress as Address,
      kind: SetupActionKind.AssignMandate,
      label: `Assign ${role.fallbackName}`,
      mandateDraftId: `mandate-${role.roleDraftId}-${index + 1}`,
      proposalTypeMask: getProposalTypeMask(role.proposalTypes),
      proposalTypes: role.proposalTypes,
      requiredSignerAddress: adminAddress,
      roleRef: { draftId: role.roleDraftId },
      spendingLimit: "0",
      startTime: "0",
      warnings: [],
    })),
  );
}

function createPolicyActions({
  adminAddress,
  chainId,
  govCoreAddress,
  inputs,
  organizationRef,
}: SetupDraftOptions & {
  readonly adminAddress?: Address;
  readonly inputs: SimpleDaoPlusDraftInputs;
  readonly organizationRef: SetupEntityReference;
}): readonly SetPolicyRuleSetupAction[] {
  const general = bodyRef(BODY_DRAFT_IDS.general);
  const treasury = bodyRef(BODY_DRAFT_IDS.treasury);
  const security = bodyRef(BODY_DRAFT_IDS.security);
  const standardExecutor =
    inputs.executorBodyChoice === "general_council" ? general : treasury;
  const standardExecutorRole =
    inputs.executorBodyChoice === "general_council"
      ? "create-general-executor"
      : "create-treasury-executor";

  return [
    {
      actionId: "set-policy-standard",
      dependsOn: [
        "create-general-council",
        "create-security-council",
        "create-general-approver",
        "create-security-vetoer",
        standardExecutorRole,
      ],
      enabled: true,
      executionStatus: SetupActionExecutionStatus.Draft,
      executorBody: standardExecutor,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      kind: SetupActionKind.SetPolicyRule,
      label: "Set standard policy route",
      organizationRef,
      proposalType: ProposalType.Standard,
      requiredApprovalBodies: [general],
      requiredSignerAddress: adminAddress,
      timelockSeconds: inputs.standardTimelockSeconds,
      vetoBodies: [security],
      warnings: [],
    },
    {
      actionId: "set-policy-treasury",
      dependsOn: [
        "create-general-council",
        "create-treasury-committee",
        "create-security-council",
        "create-general-approver",
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
      requiredSignerAddress: adminAddress,
      timelockSeconds: inputs.treasuryTimelockSeconds,
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
        standardExecutorRole,
      ],
      enabled: true,
      executionStatus: SetupActionExecutionStatus.Draft,
      executorBody: standardExecutor,
      expectedChainId: chainId,
      expectedContractAddress: govCoreAddress,
      kind: SetupActionKind.SetPolicyRule,
      label: "Set upgrade policy route",
      organizationRef,
      proposalType: ProposalType.Upgrade,
      requiredApprovalBodies: [general],
      requiredSignerAddress: adminAddress,
      timelockSeconds: inputs.upgradeTimelockSeconds,
      vetoBodies: [security],
      warnings: [],
    },
    {
      actionId: "set-policy-emergency",
      dependsOn: [
        "create-security-council",
        "create-security-approver",
        "create-security-vetoer",
        "create-security-executor",
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
      requiredSignerAddress: adminAddress,
      timelockSeconds: inputs.emergencyTimelockSeconds,
      vetoBodies: [security],
      warnings: [],
    },
  ];
}

function getHolderAddressesForRole(
  role: DraftRoleDefinition,
  inputs: SimpleDaoPlusDraftInputs,
): readonly string[] {
  if (role.roleType === RoleType.Executor) {
    return inputs.executorHolderAddress ? [inputs.executorHolderAddress] : [];
  }

  if (role.bodyDraftId === BODY_DRAFT_IDS.general) {
    return inputs.generalCouncilHolderAddresses;
  }

  if (role.bodyDraftId === BODY_DRAFT_IDS.treasury) {
    return inputs.treasuryCommitteeHolderAddresses;
  }

  if (role.bodyDraftId === BODY_DRAFT_IDS.security) {
    return inputs.securityCouncilHolderAddresses;
  }

  return [];
}

function getBodyActionId(bodyDraftId: string): string {
  const body = SIMPLE_DAO_PLUS_BODIES.find(
    (candidate) => candidate.bodyDraftId === bodyDraftId,
  );
  return body?.actionId ?? bodyDraftId;
}

function getProposalTypeMask(
  proposalTypes: readonly ProposalType[],
): NumericString {
  return proposalTypes
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

function normalizeText(value: string | undefined, fallback: string): string {
  return value === undefined ? fallback : value.trim();
}

function normalizeAddressList(values?: readonly string[]): readonly string[] {
  if (!values) {
    return [];
  }

  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function optionalString(value: string): string | undefined {
  return value.trim().length > 0 ? value.trim() : undefined;
}

function maybeAddress(value: string): Address | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? (trimmed as Address) : undefined;
}

function bodyRef(draftId: string): SetupEntityReference {
  return { draftId };
}

function sanitizeActionId(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return sanitized.replace(/^-+|-+$/g, "") || "holder";
}
