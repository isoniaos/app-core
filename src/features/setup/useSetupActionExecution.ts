import { useCallback, useMemo, useState } from "react";
import type { SetupDraft } from "@isonia/types";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useRuntimeConfig } from "../../config/runtime-config";
import { useWalletConnection } from "../../wallet/useWalletConnection";
import { executeAssignMandateAction } from "./assign-mandate-executor";
import { executeCreateBodyAction } from "./create-body-executor";
import { executeCreateOrganizationAction } from "./create-organization-executor";
import { executeCreateRoleAction } from "./create-role-executor";
import { executeSetPolicyRuleAction } from "./set-policy-rule-executor";
import {
  getAssignMandateActions,
  getCreateBodyActions,
  getCreateOrganizationAction,
  getCreateRoleActions,
  getSetPolicyRuleActions,
  isBusyStage,
} from "./setup-action-execution-helpers";
import {
  createInitialSetupDraftExecutionState,
  type SetupActionExecutorContext,
  type SetupActionReadiness,
  type SetupDraftExecutionState,
} from "./setup-action-execution-types";
import { getReadiness } from "./setup-action-readiness";

export type {
  SetupActionLifecycleStage,
  SetupActionReadiness,
  SetupActionTransaction,
  SetupDraftExecutionState,
} from "./setup-action-execution-types";

interface UseSetupActionExecutionOptions {
  readonly draft: SetupDraft;
}

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
  const account = useWalletConnection();
  const publicClient = usePublicClient({ chainId: runtimeConfig.chainId });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<SetupDraftExecutionState>(
    createInitialSetupDraftExecutionState,
  );

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

  const executorContext = useMemo<SetupActionExecutorContext>(
    () => ({
      account: {
        address: account.address,
        chainId: account.chainId,
        isConnected: account.isConnected,
      },
      client,
      publicClient,
      runtimeConfig,
      setState,
      setupWritesEnabled,
      writeContractAsync,
    }),
    [
      account.address,
      account.chainId,
      account.isConnected,
      client,
      publicClient,
      runtimeConfig,
      setupWritesEnabled,
      writeContractAsync,
    ],
  );

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
    setState(createInitialSetupDraftExecutionState());
  }, []);

  const executeCreateOrganization = useCallback(async (): Promise<void> => {
    await executeCreateOrganizationAction({
      action: createOrganizationAction,
      context: executorContext,
    });
  }, [createOrganizationAction, executorContext]);

  const executeCreateBody = useCallback(
    async (actionId: string): Promise<void> => {
      await executeCreateBodyAction({
        actionId,
        actions: createBodyActions,
        context: executorContext,
        resolvedBodyIds: state.resolvedBodyIds,
        resolvedOrgId,
      });
    },
    [
      createBodyActions,
      executorContext,
      resolvedOrgId,
      state.resolvedBodyIds,
    ],
  );

  const executeCreateRole = useCallback(
    async (actionId: string): Promise<void> => {
      await executeCreateRoleAction({
        actionId,
        actions: createRoleActions,
        bodyActions: createBodyActions,
        busy,
        context: executorContext,
        resolvedBodyIds: state.resolvedBodyIds,
        resolvedOrgId,
        resolvedRoleIds: state.resolvedRoleIds,
      });
    },
    [
      busy,
      createBodyActions,
      createRoleActions,
      executorContext,
      resolvedOrgId,
      state.resolvedBodyIds,
      state.resolvedRoleIds,
    ],
  );

  const executeAssignMandate = useCallback(
    async (actionId: string): Promise<void> => {
      await executeAssignMandateAction({
        actionId,
        actions: assignMandateActions,
        busy,
        context: executorContext,
        resolvedMandateIds: state.resolvedMandateIds,
        resolvedOrgId,
        resolvedRoleIds: state.resolvedRoleIds,
        resolvedRoles: state.resolvedRoles,
        roleActions: createRoleActions,
      });
    },
    [
      assignMandateActions,
      busy,
      createRoleActions,
      executorContext,
      resolvedOrgId,
      state.resolvedMandateIds,
      state.resolvedRoleIds,
      state.resolvedRoles,
    ],
  );

  const executeSetPolicyRule = useCallback(
    async (actionId: string): Promise<void> => {
      await executeSetPolicyRuleAction({
        actionId,
        actions: setPolicyRuleActions,
        bodyActions: createBodyActions,
        busy,
        context: executorContext,
        mandateActions: assignMandateActions,
        resolvedBodyIds: state.resolvedBodyIds,
        resolvedMandateIds: state.resolvedMandateIds,
        resolvedOrgId,
        resolvedPolicyVersions: state.resolvedPolicyVersions,
        roleActions: createRoleActions,
      });
    },
    [
      assignMandateActions,
      busy,
      createBodyActions,
      createRoleActions,
      executorContext,
      resolvedOrgId,
      setPolicyRuleActions,
      state.resolvedBodyIds,
      state.resolvedMandateIds,
      state.resolvedPolicyVersions,
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
