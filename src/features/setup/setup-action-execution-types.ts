import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type {
  Address,
  BodyDto,
  MandateDto,
  OrganizationDto,
  OrganizationPolicyDto,
  ProposalType,
  RoleDto,
  SetupActionKind,
} from "@isonia/types";
import type {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import type { RuntimeConfig } from "../../config/runtime-config";

export type SetupActionLifecycleStage =
  | "idle"
  | "wallet_pending"
  | "submitted"
  | "confirming"
  | "confirmed_waiting_indexer"
  | "indexed"
  | "failed";

export interface SetupActionTransaction {
  readonly actionId?: string;
  readonly actionKind?: SetupActionKind;
  readonly bodyId?: string;
  readonly error?: string;
  readonly holderAddress?: Address;
  readonly mandateId?: string;
  readonly orgId?: string;
  readonly policyVersion?: string;
  readonly proposalType?: ProposalType;
  readonly roleId?: string;
  readonly slug?: string;
  readonly stage: SetupActionLifecycleStage;
  readonly txHash?: `0x${string}`;
}

export interface SetupDraftExecutionState {
  readonly assignMandates: Readonly<Record<string, SetupActionTransaction>>;
  readonly createBodies: Readonly<Record<string, SetupActionTransaction>>;
  readonly createOrganization: SetupActionTransaction;
  readonly createRoles: Readonly<Record<string, SetupActionTransaction>>;
  readonly resolvedPolicies: Readonly<Record<string, OrganizationPolicyDto>>;
  readonly resolvedPolicyVersions: Readonly<Record<string, string>>;
  readonly resolvedBodies: Readonly<Record<string, BodyDto>>;
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedMandateIds: Readonly<Record<string, string>>;
  readonly resolvedMandates: Readonly<Record<string, MandateDto>>;
  readonly resolvedOrganization?: OrganizationDto;
  readonly resolvedOrgId?: string;
  readonly resolvedRoleIds: Readonly<Record<string, string>>;
  readonly resolvedRoles: Readonly<Record<string, RoleDto>>;
  readonly setPolicyRules: Readonly<Record<string, SetupActionTransaction>>;
}

export interface SetupActionReadiness {
  readonly message: string;
  readonly title: string;
}

export type SetupExecutionStateUpdater = (
  updater: (current: SetupDraftExecutionState) => SetupDraftExecutionState,
) => void;

export type SetupExecutionAccount = Pick<
  ReturnType<typeof useAccount>,
  "address" | "chainId" | "isConnected"
>;

export type SetupPublicClient = ReturnType<typeof usePublicClient>;
export type SetupWriteContractAsync = ReturnType<
  typeof useWriteContract
>["writeContractAsync"];

export interface SetupActionExecutorContext {
  readonly account: SetupExecutionAccount;
  readonly client: IsoniaControlPlaneClient;
  readonly publicClient: SetupPublicClient;
  readonly runtimeConfig: RuntimeConfig;
  readonly setState: SetupExecutionStateUpdater;
  readonly setupWritesEnabled: boolean;
  readonly writeContractAsync: SetupWriteContractAsync;
}

export interface CreateOrganizationPayload {
  readonly adminAddress: Address;
  readonly metadataUri: string;
  readonly slug: string;
}

export interface CreateBodyPayload {
  readonly bodyKindCode: number;
  readonly metadataUri: string;
  readonly orgId: string;
  readonly orgIdBigInt: bigint;
}

export interface CreateRolePayload {
  readonly bodyId: string;
  readonly bodyIdBigInt: bigint;
  readonly metadataUri: string;
  readonly orgId: string;
  readonly orgIdBigInt: bigint;
  readonly roleTypeCode: number;
}

export interface AssignMandatePayload {
  readonly endTime: string;
  readonly endTimeBigInt: bigint;
  readonly holderAddress: Address;
  readonly orgId: string;
  readonly orgIdBigInt: bigint;
  readonly proposalTypeMask: string;
  readonly proposalTypeMaskBigInt: bigint;
  readonly roleId: string;
  readonly roleIdBigInt: bigint;
  readonly spendingLimit: string;
  readonly spendingLimitBigInt: bigint;
  readonly startTime: string;
  readonly startTimeBigInt: bigint;
}

export interface SetPolicyRulePayload {
  readonly enabled: boolean;
  readonly executorBodyId: string;
  readonly executorBodyIdBigInt: bigint;
  readonly orgId: string;
  readonly orgIdBigInt: bigint;
  readonly proposalType: ProposalType;
  readonly proposalTypeCode: number;
  readonly requiredApprovalBodyIds: readonly string[];
  readonly requiredApprovalBodyIdsBigInt: readonly bigint[];
  readonly timelockSeconds: string;
  readonly timelockSecondsBigInt: bigint;
  readonly vetoBodyIds: readonly string[];
  readonly vetoBodyIdsBigInt: readonly bigint[];
}

export function createInitialSetupDraftExecutionState(): SetupDraftExecutionState {
  return {
    assignMandates: {},
    createBodies: {},
    createOrganization: { stage: "idle" },
    createRoles: {},
    resolvedBodies: {},
    resolvedBodyIds: {},
    resolvedMandateIds: {},
    resolvedMandates: {},
    resolvedRoleIds: {},
    resolvedRoles: {},
    resolvedPolicies: {},
    resolvedPolicyVersions: {},
    setPolicyRules: {},
  };
}
