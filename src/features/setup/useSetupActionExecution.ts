import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetupDraft } from "@isonia/types";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useRuntimeConfig } from "../../config/runtime-config";
import {
  useTransactionModal,
  type TransactionFlowStage,
} from "../../transactions";
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
  type SetupActionLifecycleStage,
  type SetupActionExecutorContext,
  type SetupActionReadiness,
  type SetupActionTransaction,
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
  const {
    openSingle: openTransactionModal,
    reset: resetTransactionModal,
    state: transactionModalState,
    updateItem: updateTransactionModalItem,
  } = useTransactionModal();
  const activeTransactionModalItemId = useRef<string | undefined>(undefined);
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

  useEffect(() => {
    const activeItemId = activeTransactionModalItemId.current;
    if (!transactionModalState.open || !activeItemId) {
      return;
    }

    const transaction = getSetupTransactionByModalItemId(
      activeItemId,
      returnedState,
    );
    if (!transaction) {
      return;
    }

    updateTransactionModalItem(activeItemId, {
      blockExplorerUrl: runtimeConfig.blockExplorerUrl,
      error: transaction.error,
      stage: mapSetupLifecycleStageToTransactionFlowStage(
        transaction.stage,
        "preparing",
      ),
      txHash: transaction.txHash,
    });
  }, [
    returnedState,
    runtimeConfig.blockExplorerUrl,
    transactionModalState.open,
    updateTransactionModalItem,
  ]);

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
    activeTransactionModalItemId.current = undefined;
    resetTransactionModal();
    setState(createInitialSetupDraftExecutionState());
  }, [resetTransactionModal]);

  const openSetupTransactionModal = useCallback(
    ({
      description,
      itemId,
      retry,
      title,
      transaction,
    }: {
      readonly description: string;
      readonly itemId: string;
      readonly retry: () => Promise<void>;
      readonly title: string;
      readonly transaction: SetupActionTransaction;
    }) => {
      activeTransactionModalItemId.current = itemId;
      openTransactionModal({
        description,
        item: {
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          description,
          error: transaction.error,
          id: itemId,
          retry,
          stage: mapSetupLifecycleStageToTransactionFlowStage(
            transaction.stage,
            "preparing",
          ),
          title,
          txHash: transaction.txHash,
        },
        title,
      });
    },
    [openTransactionModal, runtimeConfig.blockExplorerUrl],
  );

  const retrySetupTransaction = useCallback(
    async (itemId: string, run: () => Promise<void>): Promise<void> => {
      activeTransactionModalItemId.current = itemId;
      updateTransactionModalItem(itemId, {
        error: undefined,
        stage: "preparing",
      });
      await run();
    },
    [updateTransactionModalItem],
  );

  const runCreateOrganizationAction = useCallback(async (): Promise<void> => {
    await executeCreateOrganizationAction({
      action: createOrganizationAction,
      context: executorContext,
    });
  }, [createOrganizationAction, executorContext]);

  const runCreateBodyAction = useCallback(
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

  const runCreateRoleAction = useCallback(
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

  const runAssignMandateAction = useCallback(
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

  const runSetPolicyRuleAction = useCallback(
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

  const executeCreateOrganization = useCallback(async (): Promise<void> => {
    const itemId = SETUP_CREATE_ORGANIZATION_MODAL_ITEM_ID;
    openSetupTransactionModal({
      description:
        "Submit the organization setup action, wait for the chain receipt, then wait for Control Plane to index the organization read model.",
      itemId,
      retry: () => retrySetupTransaction(itemId, runCreateOrganizationAction),
      title: createOrganizationAction?.label ?? "Create organization",
      transaction: state.createOrganization,
    });
    await runCreateOrganizationAction();
  }, [
    createOrganizationAction?.label,
    openSetupTransactionModal,
    retrySetupTransaction,
    runCreateOrganizationAction,
    state.createOrganization,
  ]);

  const executeCreateBody = useCallback(
    async (actionId: string): Promise<void> => {
      const action = createBodyActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      const itemId = buildSetupTransactionModalItemId("create-body", actionId);
      openSetupTransactionModal({
        description:
          "Submit the body setup action, wait for the chain receipt, then wait for Control Plane to index the body read model.",
        itemId,
        retry: () => retrySetupTransaction(itemId, () => runCreateBodyAction(actionId)),
        title: action?.label ?? "Create body",
        transaction:
          state.createBodies[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
      await runCreateBodyAction(actionId);
    },
    [
      createBodyActions,
      openSetupTransactionModal,
      retrySetupTransaction,
      runCreateBodyAction,
      state.createBodies,
    ],
  );

  const executeCreateRole = useCallback(
    async (actionId: string): Promise<void> => {
      const action = createRoleActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      const itemId = buildSetupTransactionModalItemId("create-role", actionId);
      openSetupTransactionModal({
        description:
          "Submit the role setup action, wait for the chain receipt, then wait for Control Plane to index the role read model.",
        itemId,
        retry: () => retrySetupTransaction(itemId, () => runCreateRoleAction(actionId)),
        title: action?.label ?? "Create role",
        transaction:
          state.createRoles[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
      await runCreateRoleAction(actionId);
    },
    [
      createRoleActions,
      openSetupTransactionModal,
      retrySetupTransaction,
      runCreateRoleAction,
      state.createRoles,
    ],
  );

  const executeAssignMandate = useCallback(
    async (actionId: string): Promise<void> => {
      const action = assignMandateActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      const itemId = buildSetupTransactionModalItemId(
        "assign-mandate",
        actionId,
      );
      openSetupTransactionModal({
        description:
          "Submit the mandate setup action, wait for the chain receipt, then wait for Control Plane to index the mandate read model.",
        itemId,
        retry: () => retrySetupTransaction(itemId, () => runAssignMandateAction(actionId)),
        title: action?.label ?? "Assign mandate",
        transaction:
          state.assignMandates[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
      await runAssignMandateAction(actionId);
    },
    [
      assignMandateActions,
      openSetupTransactionModal,
      retrySetupTransaction,
      runAssignMandateAction,
      state.assignMandates,
    ],
  );

  const executeSetPolicyRule = useCallback(
    async (actionId: string): Promise<void> => {
      const action = setPolicyRuleActions.find(
        (candidate) => candidate.actionId === actionId,
      );
      const itemId = buildSetupTransactionModalItemId(
        "set-policy-rule",
        actionId,
      );
      openSetupTransactionModal({
        description:
          "Submit the policy setup action, wait for the chain receipt, then wait for Control Plane to index the policy read model.",
        itemId,
        retry: () => retrySetupTransaction(itemId, () => runSetPolicyRuleAction(actionId)),
        title: action?.label ?? "Set policy rule",
        transaction:
          state.setPolicyRules[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
      await runSetPolicyRuleAction(actionId);
    },
    [
      openSetupTransactionModal,
      retrySetupTransaction,
      runSetPolicyRuleAction,
      setPolicyRuleActions,
      state.setPolicyRules,
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

const SETUP_CREATE_ORGANIZATION_MODAL_ITEM_ID = "setup:create-organization";

type SetupModalActionKind =
  | "assign-mandate"
  | "create-body"
  | "create-role"
  | "set-policy-rule";

function buildSetupTransactionModalItemId(
  kind: SetupModalActionKind,
  actionId: string,
): string {
  return `setup:${kind}:${actionId}`;
}

function createIdleSetupActionTransaction(
  actionId: string,
  actionKind: SetupActionTransaction["actionKind"],
): SetupActionTransaction {
  return {
    actionId,
    actionKind,
    stage: "idle",
  };
}

function getSetupTransactionByModalItemId(
  itemId: string,
  state: SetupDraftExecutionState,
): SetupActionTransaction | undefined {
  if (itemId === SETUP_CREATE_ORGANIZATION_MODAL_ITEM_ID) {
    return state.createOrganization;
  }

  const bodyActionId = parseSetupTransactionModalItemId(itemId, "create-body");
  if (bodyActionId) {
    return state.createBodies[bodyActionId];
  }

  const roleActionId = parseSetupTransactionModalItemId(itemId, "create-role");
  if (roleActionId) {
    return state.createRoles[roleActionId];
  }

  const mandateActionId = parseSetupTransactionModalItemId(
    itemId,
    "assign-mandate",
  );
  if (mandateActionId) {
    return state.assignMandates[mandateActionId];
  }

  const policyActionId = parseSetupTransactionModalItemId(
    itemId,
    "set-policy-rule",
  );
  if (policyActionId) {
    return state.setPolicyRules[policyActionId];
  }

  return undefined;
}

function parseSetupTransactionModalItemId(
  itemId: string,
  kind: SetupModalActionKind,
): string | undefined {
  const prefix = `setup:${kind}:`;
  return itemId.startsWith(prefix) ? itemId.slice(prefix.length) : undefined;
}

function mapSetupLifecycleStageToTransactionFlowStage(
  stage: SetupActionLifecycleStage,
  idleFallback: TransactionFlowStage = "idle",
): TransactionFlowStage {
  if (stage === "idle") {
    return idleFallback;
  }
  if (stage === "indexed") {
    return "completed";
  }
  return stage;
}
