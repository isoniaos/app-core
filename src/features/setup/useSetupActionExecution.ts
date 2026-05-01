import { useCallback, useMemo, useState } from "react";
import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type {
  Address,
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
} from "@isonia/types";
import { ProposalType, SetupActionKind } from "@isonia/types";
import type { TransactionReceipt } from "viem";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import {
  type BodyCreatedLog,
  buildOrganizationSlug,
  GOV_CORE_ABI,
  type MandateAssignedLog,
  getBodyKindChainCode,
  getProposalTypeChainCode,
  getRoleTypeChainCode,
  parseBodyCreatedLog,
  parseMandateAssignedLog,
  parseOrganizationCreatedLog,
  parsePolicyRuleSetLog,
  parseRoleCreatedLog,
  type OrganizationCreatedLog,
  type PolicyRuleSetLog,
  type RoleCreatedLog,
} from "../../chain/setup-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";

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

interface UseSetupActionExecutionOptions {
  readonly draft: SetupDraft;
}

const INDEXER_POLL_INTERVAL_MS = 1_500;
const INDEXER_TIMEOUT_MS = 60_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

export function useSetupActionExecution({
  draft,
}: UseSetupActionExecutionOptions): {
  readonly busy: boolean;
  readonly executeAssignMandate: (actionId: string) => Promise<void>;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly executeSetPolicyRule: (actionId: string) => Promise<void>;
  readonly readiness: SetupActionReadiness | undefined;
  readonly reset: () => void;
  readonly state: SetupDraftExecutionState;
} {
  const runtimeConfig = useRuntimeConfig();
  const client = useIsoniaClient();
  const account = useAccount();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<SetupDraftExecutionState>({
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
  });

  const createOrganizationAction = useMemo(
    () => getCreateOrganizationAction(draft.actions),
    [draft.actions],
  );
  const createBodyActions = useMemo(
    () => getCreateBodyActions(draft.actions),
    [draft.actions],
  );
  const createRoleActions = useMemo(
    () => getCreateRoleActions(draft.actions),
    [draft.actions],
  );
  const assignMandateActions = useMemo(
    () => getAssignMandateActions(draft.actions),
    [draft.actions],
  );
  const setPolicyRuleActions = useMemo(
    () => getSetPolicyRuleActions(draft.actions),
    [draft.actions],
  );
  const resolvedOrgId = state.resolvedOrgId ?? draft.organization?.orgId;
  const returnedState = useMemo<SetupDraftExecutionState>(
    () =>
      resolvedOrgId && state.resolvedOrgId !== resolvedOrgId
        ? { ...state, resolvedOrgId }
        : state,
    [resolvedOrgId, state],
  );
  const setupWritesEnabled =
    runtimeConfig.features.writeActions && runtimeConfig.features.manageOrg;
  const readiness = useMemo(
    () =>
      getReadiness({
        accountChainId: account.chainId,
        action: createOrganizationAction,
        connected: account.isConnected,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        publicClientReady: Boolean(publicClient),
        runtimeChainId: runtimeConfig.chainId,
        setupWritesEnabled,
        transaction: state.createOrganization,
      }),
    [
      account.chainId,
      account.isConnected,
      createOrganizationAction,
      publicClient,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      state.createOrganization,
    ],
  );

  const busy =
    isBusyStage(state.createOrganization.stage) ||
    Object.values(state.createBodies).some((transaction) =>
      isBusyStage(transaction.stage),
    ) ||
    Object.values(state.createRoles).some((transaction) =>
      isBusyStage(transaction.stage),
    ) ||
    Object.values(state.assignMandates).some((transaction) =>
      isBusyStage(transaction.stage),
    ) ||
    Object.values(state.setPolicyRules).some((transaction) =>
      isBusyStage(transaction.stage),
    );

  const reset = useCallback(() => {
    setState({
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
    });
  }, []);

  const executeCreateOrganization = useCallback(async (): Promise<void> => {
    const action = createOrganizationAction;
    if (!action) {
      setState((current) => ({
        ...current,
        createOrganization: {
          stage: "failed",
          error: "No create organization setup action exists in this draft.",
        },
      }));
      return;
    }

    if (!setupWritesEnabled) {
      setActionFailed(action, "Organization setup writes are disabled by runtime config.");
      return;
    }

    if (!account.isConnected || !account.address) {
      setActionFailed(action, "Wallet is not connected.");
      return;
    }

    if (account.chainId !== runtimeConfig.chainId) {
      setActionFailed(
        action,
        `Wallet is connected to chain ${String(
          account.chainId,
        )}; expected chain ${runtimeConfig.chainId}.`,
      );
      return;
    }

    if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
      setActionFailed(
        action,
        "GovCore contract address is missing from runtime config.",
      );
      return;
    }

    if (!publicClient) {
      setActionFailed(
        action,
        "Wallet client is unavailable for the configured chain.",
      );
      return;
    }

    const payload = buildCreateOrganizationPayload(action);
    if (payload instanceof Error) {
      setActionFailed(action, payload.message);
      return;
    }

    try {
      setActionTransaction(action, {
        stage: "wallet_pending",
        slug: payload.slug,
      });
      const txHash = await writeContractAsync({
        address: runtimeConfig.contracts.govCoreAddress,
        abi: GOV_CORE_ABI,
        functionName: "createOrganization",
        args: [payload.slug, payload.metadataUri, payload.adminAddress],
        chainId: runtimeConfig.chainId,
      });

      setActionTransaction(action, {
        stage: "submitted",
        slug: payload.slug,
        txHash,
      });
      setActionTransaction(action, {
        stage: "confirming",
        slug: payload.slug,
        txHash,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      assertSuccessfulReceipt(receipt);
      const created = parseOrganizationCreatedLog(
        receipt,
        runtimeConfig.contracts.govCoreAddress,
      );
      if (!created) {
        throw new Error(
          "Transaction confirmed, but OrganizationCreated was not found in the receipt.",
        );
      }

      setActionTransaction(action, {
        orgId: created.orgId,
        stage: "confirmed_waiting_indexer",
        slug: created.slug,
        txHash,
      });
      const organization = await waitForIndexedOrganization({
        client,
        created,
        txHash,
      });

      setState((current) => ({
        ...current,
        createOrganization: {
          actionId: action.actionId,
          actionKind: action.kind,
          orgId: organization.orgId,
          slug: organization.slug,
          stage: "indexed",
          txHash,
        },
        resolvedOrgId: organization.orgId,
        resolvedOrganization: organization,
      }));
    } catch (error: unknown) {
      setActionTransaction(action, {
        stage: "failed",
        error: normalizeTransactionError(error),
        slug: payload.slug,
      });
    }

    function setActionFailed(
      failedAction: CreateOrganizationSetupAction,
      error: string,
    ): void {
      setActionTransaction(failedAction, { stage: "failed", error });
    }

    function setActionTransaction(
      nextAction: CreateOrganizationSetupAction,
      transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
    ): void {
      setState((current) => ({
        ...current,
        createOrganization: {
          actionId: nextAction.actionId,
          actionKind: nextAction.kind,
          ...transaction,
        },
      }));
    }
  }, [
    account.address,
    account.chainId,
    account.isConnected,
    client,
    createOrganizationAction,
    publicClient,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
    setupWritesEnabled,
    writeContractAsync,
  ]);

  const executeCreateBody = useCallback(
    async (actionId: string): Promise<void> => {
      const action = createBodyActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      if (!action) {
        setState((current) => ({
          ...current,
          createBodies: {
            ...current.createBodies,
            [actionId]: {
              actionId,
              actionKind: SetupActionKind.CreateBody,
              error: "No create body setup action exists for this actionId.",
              stage: "failed",
            },
          },
        }));
        return;
      }

      if (state.resolvedBodyIds[action.actionId]) {
        return;
      }

      if (!setupWritesEnabled) {
        setBodyActionFailed(action, "Organization setup writes are disabled by runtime config.");
        return;
      }

      if (!resolvedOrgId) {
        setBodyActionFailed(
          action,
          "Create body is blocked until the organization is indexed and the real orgId is resolved.",
        );
        return;
      }

      if (!account.isConnected || !account.address) {
        setBodyActionFailed(action, "Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        setBodyActionFailed(
          action,
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        );
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
        setBodyActionFailed(
          action,
          "GovCore contract address is missing from runtime config.",
        );
        return;
      }

      if (!publicClient) {
        setBodyActionFailed(
          action,
          "Wallet client is unavailable for the configured chain.",
        );
        return;
      }

      const payload = buildCreateBodyPayload(action, resolvedOrgId);
      if (payload instanceof Error) {
        setBodyActionFailed(action, payload.message);
        return;
      }

      try {
        setBodyActionTransaction(action, {
          orgId: payload.orgId,
          stage: "wallet_pending",
        });
        const txHash = await writeContractAsync({
          address: runtimeConfig.contracts.govCoreAddress,
          abi: GOV_CORE_ABI,
          functionName: "createBody",
          args: [payload.orgIdBigInt, payload.bodyKindCode, payload.metadataUri],
          chainId: runtimeConfig.chainId,
        });

        setBodyActionTransaction(action, {
          orgId: payload.orgId,
          stage: "submitted",
          txHash,
        });
        setBodyActionTransaction(action, {
          orgId: payload.orgId,
          stage: "confirming",
          txHash,
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        assertSuccessfulReceipt(receipt);
        const created = parseBodyCreatedLog(
          receipt,
          runtimeConfig.contracts.govCoreAddress,
        );
        if (!created) {
          throw new Error(
            "Transaction confirmed, but BodyCreated was not found in the receipt.",
          );
        }

        if (created.orgId !== payload.orgId) {
          throw new Error(
            `Transaction emitted body for org #${created.orgId}, but setup expected org #${payload.orgId}.`,
          );
        }

        setBodyActionTransaction(action, {
          bodyId: created.bodyId,
          orgId: created.orgId,
          stage: "confirmed_waiting_indexer",
          txHash,
        });
        const body = await waitForIndexedBody({
          client,
          created,
          txHash,
        });

        setState((current) => ({
          ...current,
          createBodies: {
            ...current.createBodies,
            [action.actionId]: {
              actionId: action.actionId,
              actionKind: action.kind,
              bodyId: body.bodyId,
              orgId: body.orgId,
              stage: "indexed",
              txHash,
            },
          },
          resolvedBodies: {
            ...current.resolvedBodies,
            [action.actionId]: body,
          },
          resolvedBodyIds: {
            ...current.resolvedBodyIds,
            [action.actionId]: body.bodyId,
          },
        }));
      } catch (error: unknown) {
        setBodyActionTransaction(action, {
          error: normalizeTransactionError(error),
          orgId: payload.orgId,
          stage: "failed",
        });
      }

      function setBodyActionFailed(
        failedAction: CreateBodySetupAction,
        error: string,
      ): void {
        setBodyActionTransaction(failedAction, { stage: "failed", error });
      }

      function setBodyActionTransaction(
        nextAction: CreateBodySetupAction,
        transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
      ): void {
        setState((current) => ({
          ...current,
          createBodies: {
            ...current.createBodies,
            [nextAction.actionId]: {
              actionId: nextAction.actionId,
              actionKind: nextAction.kind,
              ...transaction,
            },
          },
        }));
      }
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      client,
      createBodyActions,
      publicClient,
      resolvedOrgId,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      state.resolvedBodyIds,
      writeContractAsync,
    ],
  );

  const executeCreateRole = useCallback(
    async (actionId: string): Promise<void> => {
      const action = createRoleActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      if (!action) {
        setState((current) => ({
          ...current,
          createRoles: {
            ...current.createRoles,
            [actionId]: {
              actionId,
              actionKind: SetupActionKind.CreateRole,
              error: "No create role setup action exists for this actionId.",
              stage: "failed",
            },
          },
        }));
        return;
      }

      if (state.resolvedRoleIds[action.actionId]) {
        return;
      }

      if (busy) {
        setRoleActionFailed(action, "Another setup transaction is active.");
        return;
      }

      if (!setupWritesEnabled) {
        setRoleActionFailed(action, "Organization setup writes are disabled by runtime config.");
        return;
      }

      if (!resolvedOrgId) {
        setRoleActionFailed(
          action,
          "Create role is blocked until the organization is indexed and the real orgId is resolved.",
        );
        return;
      }

      const resolvedBodyId = resolveBodyReference({
        bodyActions: createBodyActions,
        reference: action.bodyRef,
        resolvedBodyIds: state.resolvedBodyIds,
      });
      if (!resolvedBodyId) {
        setRoleActionFailed(
          action,
          "Create role is blocked until the referenced body is indexed and the real bodyId is resolved.",
        );
        return;
      }

      if (!account.isConnected || !account.address) {
        setRoleActionFailed(action, "Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        setRoleActionFailed(
          action,
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        );
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
        setRoleActionFailed(
          action,
          "GovCore contract address is missing from runtime config.",
        );
        return;
      }

      if (!publicClient) {
        setRoleActionFailed(
          action,
          "Wallet client is unavailable for the configured chain.",
        );
        return;
      }

      const payload = buildCreateRolePayload(action, resolvedOrgId, resolvedBodyId);
      if (payload instanceof Error) {
        setRoleActionFailed(action, payload.message);
        return;
      }

      try {
        setRoleActionTransaction(action, {
          bodyId: payload.bodyId,
          orgId: payload.orgId,
          stage: "wallet_pending",
        });
        const txHash = await writeContractAsync({
          address: runtimeConfig.contracts.govCoreAddress,
          abi: GOV_CORE_ABI,
          functionName: "createRole",
          args: [
            payload.orgIdBigInt,
            payload.bodyIdBigInt,
            payload.roleTypeCode,
            payload.metadataUri,
          ],
          chainId: runtimeConfig.chainId,
        });

        setRoleActionTransaction(action, {
          bodyId: payload.bodyId,
          orgId: payload.orgId,
          stage: "submitted",
          txHash,
        });
        setRoleActionTransaction(action, {
          bodyId: payload.bodyId,
          orgId: payload.orgId,
          stage: "confirming",
          txHash,
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        assertSuccessfulReceipt(receipt);
        const created = parseRoleCreatedLog(
          receipt,
          runtimeConfig.contracts.govCoreAddress,
        );
        if (!created) {
          throw new Error(
            "Transaction confirmed, but RoleCreated was not found in the receipt.",
          );
        }

        if (created.orgId !== payload.orgId) {
          throw new Error(
            `Transaction emitted role for org #${created.orgId}, but setup expected org #${payload.orgId}.`,
          );
        }

        if (created.bodyId !== payload.bodyId) {
          throw new Error(
            `Transaction emitted role for body #${created.bodyId}, but setup expected body #${payload.bodyId}.`,
          );
        }

        if (created.roleType !== action.roleType) {
          throw new Error(
            `Transaction emitted ${created.roleType}, but setup expected ${action.roleType}.`,
          );
        }

        setRoleActionTransaction(action, {
          bodyId: created.bodyId,
          orgId: created.orgId,
          roleId: created.roleId,
          stage: "confirmed_waiting_indexer",
          txHash,
        });
        const role = await waitForIndexedRole({
          client,
          created,
          txHash,
        });

        setState((current) => ({
          ...current,
          createRoles: {
            ...current.createRoles,
            [action.actionId]: {
              actionId: action.actionId,
              actionKind: action.kind,
              bodyId: role.bodyId,
              orgId: role.orgId,
              roleId: role.roleId,
              stage: "indexed",
              txHash,
            },
          },
          resolvedRoleIds: {
            ...current.resolvedRoleIds,
            [action.actionId]: role.roleId,
          },
          resolvedRoles: {
            ...current.resolvedRoles,
            [action.actionId]: role,
          },
        }));
      } catch (error: unknown) {
        setRoleActionTransaction(action, {
          bodyId: payload.bodyId,
          error: normalizeTransactionError(error),
          orgId: payload.orgId,
          stage: "failed",
        });
      }

      function setRoleActionFailed(
        failedAction: CreateRoleSetupAction,
        error: string,
      ): void {
        setRoleActionTransaction(failedAction, { stage: "failed", error });
      }

      function setRoleActionTransaction(
        nextAction: CreateRoleSetupAction,
        transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
      ): void {
        setState((current) => ({
          ...current,
          createRoles: {
            ...current.createRoles,
            [nextAction.actionId]: {
              actionId: nextAction.actionId,
              actionKind: nextAction.kind,
              ...transaction,
            },
          },
        }));
      }
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      busy,
      client,
      createBodyActions,
      createRoleActions,
      publicClient,
      resolvedOrgId,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      state.resolvedBodyIds,
      state.resolvedRoleIds,
      writeContractAsync,
    ],
  );

  const executeAssignMandate = useCallback(
    async (actionId: string): Promise<void> => {
      const action = assignMandateActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      if (!action) {
        setState((current) => ({
          ...current,
          assignMandates: {
            ...current.assignMandates,
            [actionId]: {
              actionId,
              actionKind: SetupActionKind.AssignMandate,
              error: "No assign mandate setup action exists for this actionId.",
              stage: "failed",
            },
          },
        }));
        return;
      }

      if (state.resolvedMandateIds[action.actionId]) {
        return;
      }

      if (busy) {
        setMandateActionFailed(action, "Another setup transaction is active.");
        return;
      }

      if (!setupWritesEnabled) {
        setMandateActionFailed(
          action,
          "Organization setup writes are disabled by runtime config.",
        );
        return;
      }

      if (!resolvedOrgId) {
        setMandateActionFailed(
          action,
          "Assign mandate is blocked until the organization is indexed and the real orgId is resolved.",
        );
        return;
      }

      const resolvedRoleId = resolveRoleReference({
        reference: action.roleRef,
        resolvedRoleIds: state.resolvedRoleIds,
        roleActions: createRoleActions,
      });
      if (!resolvedRoleId) {
        setMandateActionFailed(
          action,
          "Assign mandate is blocked until the referenced role is indexed and the real roleId is resolved.",
        );
        return;
      }

      if (!account.isConnected || !account.address) {
        setMandateActionFailed(action, "Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        setMandateActionFailed(
          action,
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        );
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
        setMandateActionFailed(
          action,
          "GovCore contract address is missing from runtime config.",
        );
        return;
      }

      if (!publicClient) {
        setMandateActionFailed(
          action,
          "Wallet client is unavailable for the configured chain.",
        );
        return;
      }

      const payload = buildAssignMandatePayload(
        action,
        resolvedOrgId,
        resolvedRoleId,
      );
      if (payload instanceof Error) {
        setMandateActionFailed(action, payload.message);
        return;
      }

      try {
        setMandateActionTransaction(action, {
          holderAddress: payload.holderAddress,
          orgId: payload.orgId,
          roleId: payload.roleId,
          stage: "wallet_pending",
        });
        const txHash = await writeContractAsync({
          address: runtimeConfig.contracts.govCoreAddress,
          abi: GOV_CORE_ABI,
          functionName: "assignMandate",
          args: [
            payload.orgIdBigInt,
            payload.roleIdBigInt,
            payload.holderAddress,
            payload.startTimeBigInt,
            payload.endTimeBigInt,
            payload.proposalTypeMaskBigInt,
            payload.spendingLimitBigInt,
          ],
          chainId: runtimeConfig.chainId,
        });

        setMandateActionTransaction(action, {
          holderAddress: payload.holderAddress,
          orgId: payload.orgId,
          roleId: payload.roleId,
          stage: "submitted",
          txHash,
        });
        setMandateActionTransaction(action, {
          holderAddress: payload.holderAddress,
          orgId: payload.orgId,
          roleId: payload.roleId,
          stage: "confirming",
          txHash,
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        assertSuccessfulReceipt(receipt);
        const assigned = parseMandateAssignedLog(
          receipt,
          runtimeConfig.contracts.govCoreAddress,
        );
        if (!assigned) {
          throw new Error(
            "Transaction confirmed, but MandateAssigned was not found in the receipt.",
          );
        }

        assertMandateMatchesPayload(assigned, payload);

        const resolvedRole = resolveRoleReadModel({
          reference: action.roleRef,
          resolvedRoles: state.resolvedRoles,
          roleActions: createRoleActions,
        });
        if (resolvedRole && assigned.bodyId !== resolvedRole.bodyId) {
          throw new Error(
            `Transaction emitted mandate for body #${assigned.bodyId}, but setup expected body #${resolvedRole.bodyId}.`,
          );
        }

        setMandateActionTransaction(action, {
          bodyId: assigned.bodyId,
          holderAddress: assigned.holderAddress,
          mandateId: assigned.mandateId,
          orgId: assigned.orgId,
          roleId: assigned.roleId,
          stage: "confirmed_waiting_indexer",
          txHash,
        });
        const mandate = await waitForIndexedMandate({
          assigned,
          client,
          payload,
          txHash,
        });

        setState((current) => ({
          ...current,
          assignMandates: {
            ...current.assignMandates,
            [action.actionId]: {
              actionId: action.actionId,
              actionKind: action.kind,
              bodyId: mandate.bodyId,
              holderAddress: mandate.holderAddress,
              mandateId: mandate.mandateId,
              orgId: mandate.orgId,
              roleId: mandate.roleId,
              stage: "indexed",
              txHash,
            },
          },
          resolvedMandateIds: {
            ...current.resolvedMandateIds,
            [action.actionId]: mandate.mandateId,
          },
          resolvedMandates: {
            ...current.resolvedMandates,
            [action.actionId]: mandate,
          },
        }));
      } catch (error: unknown) {
        setMandateActionTransaction(action, {
          error: normalizeTransactionError(error),
          holderAddress: payload.holderAddress,
          orgId: payload.orgId,
          roleId: payload.roleId,
          stage: "failed",
        });
      }

      function setMandateActionFailed(
        failedAction: AssignMandateSetupAction,
        error: string,
      ): void {
        setMandateActionTransaction(failedAction, { stage: "failed", error });
      }

      function setMandateActionTransaction(
        nextAction: AssignMandateSetupAction,
        transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
      ): void {
        setState((current) => ({
          ...current,
          assignMandates: {
            ...current.assignMandates,
            [nextAction.actionId]: {
              actionId: nextAction.actionId,
              actionKind: nextAction.kind,
              ...transaction,
            },
          },
        }));
      }
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      assignMandateActions,
      busy,
      client,
      createRoleActions,
      publicClient,
      resolvedOrgId,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      state.resolvedMandateIds,
      state.resolvedRoleIds,
      state.resolvedRoles,
      writeContractAsync,
    ],
  );

  const executeSetPolicyRule = useCallback(
    async (actionId: string): Promise<void> => {
      const action = setPolicyRuleActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      if (!action) {
        setState((current) => ({
          ...current,
          setPolicyRules: {
            ...current.setPolicyRules,
            [actionId]: {
              actionId,
              actionKind: SetupActionKind.SetPolicyRule,
              error: "No set policy rule setup action exists for this actionId.",
              stage: "failed",
            },
          },
        }));
        return;
      }

      if (state.resolvedPolicyVersions[action.actionId]) {
        return;
      }

      if (busy) {
        setPolicyActionFailed(action, "Another setup transaction is active.");
        return;
      }

      if (!setupWritesEnabled) {
        setPolicyActionFailed(
          action,
          "Organization setup writes are disabled by runtime config.",
        );
        return;
      }

      if (!resolvedOrgId) {
        setPolicyActionFailed(
          action,
          "Set policy rule is blocked until the organization is indexed and the real orgId is resolved.",
        );
        return;
      }

      const unresolvedMandates = getPolicyMandateDependencies({
        mandateActions: assignMandateActions,
        policy: action,
        roleActions: createRoleActions,
      }).filter((mandate) => !state.resolvedMandateIds[mandate.actionId]);
      if (unresolvedMandates.length > 0) {
        setPolicyActionFailed(
          action,
          `Set policy rule is blocked until ${unresolvedMandates.length.toLocaleString()} related mandate action${unresolvedMandates.length === 1 ? "" : "s"} are indexed.`,
        );
        return;
      }

      if (!account.isConnected || !account.address) {
        setPolicyActionFailed(action, "Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        setPolicyActionFailed(
          action,
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        );
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
        setPolicyActionFailed(
          action,
          "GovCore contract address is missing from runtime config.",
        );
        return;
      }

      if (!publicClient) {
        setPolicyActionFailed(
          action,
          "Wallet client is unavailable for the configured chain.",
        );
        return;
      }

      const payload = buildSetPolicyRulePayload({
        action,
        bodyActions: createBodyActions,
        resolvedBodyIds: state.resolvedBodyIds,
        resolvedOrgId,
      });
      if (payload instanceof Error) {
        setPolicyActionFailed(action, payload.message);
        return;
      }

      try {
        setPolicyActionTransaction(action, {
          orgId: payload.orgId,
          proposalType: payload.proposalType,
          stage: "wallet_pending",
        });
        const txHash = await writeContractAsync({
          address: runtimeConfig.contracts.govCoreAddress,
          abi: GOV_CORE_ABI,
          functionName: "setPolicyRule",
          args: [
            payload.orgIdBigInt,
            payload.proposalTypeCode,
            payload.requiredApprovalBodyIdsBigInt,
            payload.vetoBodyIdsBigInt,
            payload.executorBodyIdBigInt,
            payload.timelockSecondsBigInt,
            payload.enabled,
          ],
          chainId: runtimeConfig.chainId,
        });

        setPolicyActionTransaction(action, {
          orgId: payload.orgId,
          proposalType: payload.proposalType,
          stage: "submitted",
          txHash,
        });
        setPolicyActionTransaction(action, {
          orgId: payload.orgId,
          proposalType: payload.proposalType,
          stage: "confirming",
          txHash,
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        assertSuccessfulReceipt(receipt);
        const policySet = parsePolicyRuleSetLog(
          receipt,
          runtimeConfig.contracts.govCoreAddress,
        );
        if (!policySet) {
          throw new Error(
            "Transaction confirmed, but PolicyRuleSet was not found in the receipt.",
          );
        }

        assertPolicyRuleMatchesPayload(policySet, payload);

        setPolicyActionTransaction(action, {
          orgId: policySet.orgId,
          policyVersion: policySet.version,
          proposalType: policySet.proposalType,
          stage: "confirmed_waiting_indexer",
          txHash,
        });
        const policy = await waitForIndexedPolicyRule({
          client,
          payload,
          policySet,
          txHash,
        });

        setState((current) => ({
          ...current,
          resolvedPolicies: {
            ...current.resolvedPolicies,
            [action.actionId]: policy,
          },
          resolvedPolicyVersions: {
            ...current.resolvedPolicyVersions,
            [action.actionId]: policy.version,
          },
          setPolicyRules: {
            ...current.setPolicyRules,
            [action.actionId]: {
              actionId: action.actionId,
              actionKind: action.kind,
              orgId: policy.orgId,
              policyVersion: policy.version,
              proposalType: policy.proposalType,
              stage: "indexed",
              txHash,
            },
          },
        }));
      } catch (error: unknown) {
        setPolicyActionTransaction(action, {
          error: normalizeTransactionError(error),
          orgId: payload.orgId,
          proposalType: payload.proposalType,
          stage: "failed",
        });
      }

      function setPolicyActionFailed(
        failedAction: SetPolicyRuleSetupAction,
        error: string,
      ): void {
        setPolicyActionTransaction(failedAction, { stage: "failed", error });
      }

      function setPolicyActionTransaction(
        nextAction: SetPolicyRuleSetupAction,
        transaction: Omit<SetupActionTransaction, "actionId" | "actionKind">,
      ): void {
        setState((current) => ({
          ...current,
          setPolicyRules: {
            ...current.setPolicyRules,
            [nextAction.actionId]: {
              actionId: nextAction.actionId,
              actionKind: nextAction.kind,
              ...transaction,
            },
          },
        }));
      }
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      assignMandateActions,
      busy,
      client,
      createBodyActions,
      createRoleActions,
      publicClient,
      resolvedOrgId,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setPolicyRuleActions,
      setupWritesEnabled,
      state.resolvedBodyIds,
      state.resolvedMandateIds,
      state.resolvedPolicyVersions,
      writeContractAsync,
    ],
  );

  return {
    busy,
    executeAssignMandate,
    executeCreateBody,
    executeCreateOrganization,
    executeCreateRole,
    executeSetPolicyRule,
    readiness,
    reset,
    state: returnedState,
  };
}

interface CreateOrganizationPayload {
  readonly adminAddress: Address;
  readonly metadataUri: string;
  readonly slug: string;
}

interface CreateBodyPayload {
  readonly bodyKindCode: number;
  readonly metadataUri: string;
  readonly orgId: string;
  readonly orgIdBigInt: bigint;
}

interface CreateRolePayload {
  readonly bodyId: string;
  readonly bodyIdBigInt: bigint;
  readonly metadataUri: string;
  readonly orgId: string;
  readonly orgIdBigInt: bigint;
  readonly roleTypeCode: number;
}

interface AssignMandatePayload {
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

interface SetPolicyRulePayload {
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

function buildCreateOrganizationPayload(
  action: CreateOrganizationSetupAction,
): CreateOrganizationPayload | Error {
  if (!isAddress(action.adminAddress) || isZeroAddress(action.adminAddress)) {
    return new Error("Organization admin address must be a non-zero EVM address.");
  }

  const slug = buildOrganizationSlug(action.fallbackName);
  if (!slug) {
    return new Error("Organization slug must not be empty.");
  }

  return {
    adminAddress: action.adminAddress,
    metadataUri: action.metadataUri ?? "",
    slug,
  };
}

function buildCreateBodyPayload(
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

  let orgIdBigInt: bigint;
  try {
    orgIdBigInt = BigInt(resolvedOrgId);
  } catch {
    return new Error(`Resolved orgId is not a valid uint64 value: ${resolvedOrgId}.`);
  }

  if (orgIdBigInt <= 0n) {
    return new Error(`Resolved orgId must be greater than zero: ${resolvedOrgId}.`);
  }

  return {
    bodyKindCode,
    metadataUri: action.metadataUri ?? "",
    orgId: resolvedOrgId,
    orgIdBigInt,
  };
}

function buildCreateRolePayload(
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

function buildAssignMandatePayload(
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
    return new Error("Mandate proposal type mask must cover at least one proposal type.");
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

function buildSetPolicyRulePayload({
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

async function waitForIndexedOrganization({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: OrganizationCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<OrganizationDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const organizations = await client.getOrganizations();
      const byTxHash = organizations.find((organization) =>
        sameHex(organization.createdTxHash, txHash),
      );
      if (byTxHash) {
        return byTxHash;
      }

      const byCreatedId = organizations.find(
        (organization) =>
          organization.orgId === created.orgId &&
          sameAddress(organization.adminAddress, created.adminAddress) &&
          organization.slug === created.slug,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: organization from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

async function waitForIndexedBody({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: BodyCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<BodyDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const bodies = await client.getBodies(created.orgId);
      const byCreatedId = bodies.find(
        (body) =>
          body.orgId === created.orgId &&
          body.bodyId === created.bodyId &&
          body.kind === created.kind,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: body #${created.bodyId} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

async function waitForIndexedRole({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: RoleCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<RoleDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const roles = await client.getRoles(created.orgId);
      const byCreatedId = roles.find(
        (role) =>
          role.orgId === created.orgId &&
          role.bodyId === created.bodyId &&
          role.roleId === created.roleId &&
          role.roleType === created.roleType,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: role #${created.roleId} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

async function waitForIndexedMandate({
  assigned,
  client,
  payload,
  txHash,
}: {
  readonly assigned: MandateAssignedLog;
  readonly client: IsoniaControlPlaneClient;
  readonly payload: AssignMandatePayload;
  readonly txHash: `0x${string}`;
}): Promise<MandateDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const mandates = await client.getMandates(assigned.orgId);
      const byCreatedId = mandates.find((mandate) =>
        mandateMatchesAssignedLog(mandate, assigned),
      );
      if (byCreatedId) {
        return byCreatedId;
      }

      const byContext = mandates.find((mandate) =>
        mandateMatchesPayloadContext(mandate, payload),
      );
      if (byContext) {
        return byContext;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: mandate #${assigned.mandateId} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

async function waitForIndexedPolicyRule({
  client,
  payload,
  policySet,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly payload: SetPolicyRulePayload;
  readonly policySet: PolicyRuleSetLog;
  readonly txHash: `0x${string}`;
}): Promise<OrganizationPolicyDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const policies = await client.policies.list(policySet.orgId);
      const byVersion = policies.find((policy) =>
        policyMatchesPolicySetLog(policy, policySet),
      );
      if (byVersion) {
        assertIndexedPolicyMatchesPayload(byVersion, payload);
        return byVersion;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: policy ${policySet.proposalType} v${policySet.version} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

function getReadiness({
  accountChainId,
  action,
  connected,
  govCoreAddress,
  publicClientReady,
  runtimeChainId,
  setupWritesEnabled,
  transaction,
}: {
  readonly accountChainId: number | undefined;
  readonly action: CreateOrganizationSetupAction | undefined;
  readonly connected: boolean;
  readonly govCoreAddress: Address;
  readonly publicClientReady: boolean;
  readonly runtimeChainId: number;
  readonly setupWritesEnabled: boolean;
  readonly transaction: SetupActionTransaction;
}): SetupActionReadiness | undefined {
  if (transaction.stage === "indexed") {
    return {
      title: "Organization indexed",
      message: "The real orgId has been resolved from Control Plane read models.",
    };
  }

  if (!action) {
    return {
      title: "No create organization action",
      message: "This draft is already attached to an indexed organization.",
    };
  }

  if (!setupWritesEnabled) {
    return {
      title: "Setup writes disabled",
      message: "Enable features.writeActions and features.manageOrg in runtime config.",
    };
  }

  if (!isConfiguredAddress(govCoreAddress)) {
    return {
      title: "Protocol config missing",
      message: "Set contracts.govCoreAddress in runtime config.",
    };
  }

  if (action.warnings.some((warning) => warning.severity === "error")) {
    return {
      title: "Create organization blocked",
      message: "Resolve the create organization validation errors before submitting.",
    };
  }

  if (!connected) {
    return {
      title: "Wallet not connected",
      message: "Connect a wallet before submitting the setup action.",
    };
  }

  if (accountChainId !== runtimeChainId) {
    return {
      title: "Wrong chain",
      message: `Connected chain ${String(
        accountChainId,
      )}; expected chain ${runtimeChainId}.`,
    };
  }

  if (!publicClientReady) {
    return {
      title: "Protocol client unavailable",
      message: "The configured chain client is not ready.",
    };
  }

  return undefined;
}

function getCreateOrganizationAction(
  actions: readonly SetupAction[],
): CreateOrganizationSetupAction | undefined {
  return actions.find(
    (action): action is CreateOrganizationSetupAction =>
      action.kind === SetupActionKind.CreateOrganization,
  );
}

function getCreateBodyActions(
  actions: readonly SetupAction[],
): readonly CreateBodySetupAction[] {
  return actions.filter(
    (action): action is CreateBodySetupAction =>
      action.kind === SetupActionKind.CreateBody,
  );
}

function getCreateRoleActions(
  actions: readonly SetupAction[],
): readonly CreateRoleSetupAction[] {
  return actions.filter(
    (action): action is CreateRoleSetupAction =>
      action.kind === SetupActionKind.CreateRole,
  );
}

function getAssignMandateActions(
  actions: readonly SetupAction[],
): readonly AssignMandateSetupAction[] {
  return actions.filter(
    (action): action is AssignMandateSetupAction =>
      action.kind === SetupActionKind.AssignMandate,
  );
}

function getSetPolicyRuleActions(
  actions: readonly SetupAction[],
): readonly SetPolicyRuleSetupAction[] {
  return actions.filter(
    (action): action is SetPolicyRuleSetupAction =>
      action.kind === SetupActionKind.SetPolicyRule,
  );
}

function resolveBodyReference({
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

function resolveRoleReference({
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

function resolveRoleReadModel({
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

function resolvePolicyBodyReferences({
  bodyActions,
  label,
  references,
  resolvedBodyIds,
}: {
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly label: string;
  readonly references: readonly { readonly draftId?: string; readonly indexedId?: string }[];
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

function parsePolicyBodyIdArray(
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

function assertSuccessfulReceipt(receipt: TransactionReceipt): void {
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

function parsePositiveUint64(value: string, label: string): bigint | Error {
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

function parseUint64(value: string, label: string): bigint | Error {
  return parseUint(value, label, MAX_UINT64, "uint64");
}

function parseUint128(value: string, label: string): bigint | Error {
  return parseUint(value, label, MAX_UINT128, "uint128");
}

function parseUint256(value: string, label: string): bigint | Error {
  return parseUint(value, label, MAX_UINT256, "uint256");
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

function assertMandateMatchesPayload(
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

function mandateMatchesAssignedLog(
  mandate: MandateDto,
  assigned: MandateAssignedLog,
): boolean {
  return (
    mandate.orgId === assigned.orgId &&
    mandate.mandateId === assigned.mandateId &&
    mandate.bodyId === assigned.bodyId &&
    mandate.roleId === assigned.roleId &&
    sameAddress(mandate.holderAddress, assigned.holderAddress) &&
    mandate.startTime === assigned.startTime &&
    mandate.endTime === assigned.endTime &&
    mandate.proposalTypeMask === assigned.proposalTypeMask &&
    mandate.spendingLimit === assigned.spendingLimit
  );
}

function mandateMatchesPayloadContext(
  mandate: MandateDto,
  payload: AssignMandatePayload,
): boolean {
  return (
    mandate.orgId === payload.orgId &&
    mandate.roleId === payload.roleId &&
    sameAddress(mandate.holderAddress, payload.holderAddress) &&
    mandate.startTime === payload.startTime &&
    mandate.endTime === payload.endTime &&
    mandate.proposalTypeMask === payload.proposalTypeMask &&
    mandate.spendingLimit === payload.spendingLimit &&
    mandate.active &&
    !mandate.revoked
  );
}

function assertPolicyRuleMatchesPayload(
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

function assertIndexedPolicyMatchesPayload(
  policy: OrganizationPolicyDto,
  payload: SetPolicyRulePayload,
): void {
  if (!sameStringArray(policy.requiredApprovalBodies, payload.requiredApprovalBodyIds)) {
    throw new Error(
      "Indexed policy approval bodies do not match the resolved draft bodyIds.",
    );
  }

  if (!sameStringArray(policy.vetoBodies, payload.vetoBodyIds)) {
    throw new Error(
      "Indexed policy veto bodies do not match the resolved draft bodyIds.",
    );
  }

  if ((policy.executorBody ?? "0") !== payload.executorBodyId) {
    throw new Error(
      `Indexed policy executor body #${policy.executorBody ?? "0"} does not match expected #${payload.executorBodyId}.`,
    );
  }

  if (policy.timelockSeconds !== payload.timelockSeconds) {
    throw new Error(
      `Indexed policy timelock ${policy.timelockSeconds} does not match expected ${payload.timelockSeconds}.`,
    );
  }

  if (policy.enabled !== payload.enabled) {
    throw new Error(
      `Indexed policy enabled=${String(policy.enabled)} does not match expected enabled=${String(payload.enabled)}.`,
    );
  }
}

function policyMatchesPolicySetLog(
  policy: OrganizationPolicyDto,
  policySet: PolicyRuleSetLog,
): boolean {
  return (
    policy.orgId === policySet.orgId &&
    policy.proposalType === policySet.proposalType &&
    policy.version === policySet.version &&
    sameStringArray(policy.requiredApprovalBodies, policySet.requiredApprovalBodies) &&
    sameStringArray(policy.vetoBodies, policySet.vetoBodies) &&
    (policy.executorBody ?? "0") === policySet.executorBody &&
    policy.timelockSeconds === policySet.timelockSeconds &&
    policy.enabled === policySet.enabled
  );
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getPolicyMandateDependencies({
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

function getProposalTypeMask(proposalTypes: readonly ProposalType[]): bigint {
  return proposalTypes.reduce(
    (mask, proposalType) => mask | proposalTypeMaskBit(proposalType),
    0n,
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

function isBusyStage(stage: SetupActionLifecycleStage): boolean {
  return (
    stage === "wallet_pending" ||
    stage === "submitted" ||
    stage === "confirming" ||
    stage === "confirmed_waiting_indexer"
  );
}

function isConfiguredAddress(value: Address): boolean {
  return isAddress(value) && !isZeroAddress(value);
}

function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === ZERO_ADDRESS;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeTransactionError(error: unknown): string {
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

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}
