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
  deriveSetupExecutionStateFromReadModels,
  type SetupCompletionReadModels,
} from "./setup-completion-verification";
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
  readonly readModels?: SetupCompletionReadModels;
}

export function useSetupActionExecution({
  draft,
  readModels,
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
    () => {
      const stateWithOrgId =
        resolvedOrgId && state.resolvedOrgId !== resolvedOrgId
          ? { ...state, resolvedOrgId }
          : state;

      return deriveSetupExecutionStateFromReadModels({
        draft,
        executionState: stateWithOrgId,
        readModels,
      });
    },
    [draft, readModels, resolvedOrgId, state],
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
        "idle",
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
        transaction: returnedState.createOrganization,
      }),
    [
      account.chainId,
      account.isConnected,
      createOrganizationAction,
      publicClient,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      returnedState.createOrganization,
    ],
  );

  const busy =
    isBusyStage(returnedState.createOrganization.stage) ||
    Object.values(returnedState.createBodies).some((transaction) =>
      isBusyStage(transaction.stage),
    ) ||
    Object.values(returnedState.createRoles).some((transaction) =>
      isBusyStage(transaction.stage),
    ) ||
    Object.values(returnedState.assignMandates).some((transaction) =>
      isBusyStage(transaction.stage),
    ) ||
    Object.values(returnedState.setPolicyRules).some((transaction) =>
      isBusyStage(transaction.stage),
    );

  const reset = useCallback(() => {
    activeTransactionModalItemId.current = undefined;
    resetTransactionModal();
    setState(createInitialSetupDraftExecutionState());
  }, [resetTransactionModal]);

  const startSetupTransaction = useCallback(
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

  const openSetupTransactionModal = useCallback(
    ({
      description,
      itemId,
      run,
      title,
      transaction,
    }: {
      readonly description: string;
      readonly itemId: string;
      readonly run: () => Promise<void>;
      readonly title: string;
      readonly transaction: SetupActionTransaction;
    }) => {
      activeTransactionModalItemId.current = itemId;
      const start = () => startSetupTransaction(itemId, run);
      openTransactionModal({
        description,
        item: {
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          description,
          error: transaction.error,
          execute: start,
          id: itemId,
          retry: start,
          stage: mapSetupLifecycleStageToTransactionFlowStage(
            transaction.stage,
            "idle",
          ),
          title,
          txHash: transaction.txHash,
        },
        title,
      });
    },
    [openTransactionModal, runtimeConfig.blockExplorerUrl, startSetupTransaction],
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
        resolvedBodyIds: returnedState.resolvedBodyIds,
        resolvedOrgId: returnedState.resolvedOrgId ?? resolvedOrgId,
      });
    },
    [
      createBodyActions,
      executorContext,
      resolvedOrgId,
      returnedState.resolvedBodyIds,
      returnedState.resolvedOrgId,
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
        resolvedBodyIds: returnedState.resolvedBodyIds,
        resolvedOrgId: returnedState.resolvedOrgId ?? resolvedOrgId,
        resolvedRoleIds: returnedState.resolvedRoleIds,
      });
    },
    [
      busy,
      createBodyActions,
      createRoleActions,
      executorContext,
      resolvedOrgId,
      returnedState.resolvedBodyIds,
      returnedState.resolvedOrgId,
      returnedState.resolvedRoleIds,
    ],
  );

  const runAssignMandateAction = useCallback(
    async (actionId: string): Promise<void> => {
      await executeAssignMandateAction({
        actionId,
        actions: assignMandateActions,
        busy,
        context: executorContext,
        resolvedMandateIds: returnedState.resolvedMandateIds,
        resolvedOrgId: returnedState.resolvedOrgId ?? resolvedOrgId,
        resolvedRoleIds: returnedState.resolvedRoleIds,
        resolvedRoles: returnedState.resolvedRoles,
        roleActions: createRoleActions,
      });
    },
    [
      assignMandateActions,
      busy,
      createRoleActions,
      executorContext,
      resolvedOrgId,
      returnedState.resolvedMandateIds,
      returnedState.resolvedOrgId,
      returnedState.resolvedRoleIds,
      returnedState.resolvedRoles,
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
        resolvedBodyIds: returnedState.resolvedBodyIds,
        resolvedMandateIds: returnedState.resolvedMandateIds,
        resolvedOrgId: returnedState.resolvedOrgId ?? resolvedOrgId,
        resolvedPolicyVersions: returnedState.resolvedPolicyVersions,
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
      returnedState.resolvedBodyIds,
      returnedState.resolvedMandateIds,
      returnedState.resolvedOrgId,
      returnedState.resolvedPolicyVersions,
    ],
  );

  const executeCreateOrganization = useCallback(async (): Promise<void> => {
    const itemId = SETUP_CREATE_ORGANIZATION_MODAL_ITEM_ID;
    openSetupTransactionModal({
      description:
        "Submit the organization setup action, wait for the chain receipt, then wait for Control Plane to index the organization read model.",
      itemId,
      run: runCreateOrganizationAction,
      title: createOrganizationAction?.label ?? "Create organization",
      transaction: returnedState.createOrganization,
    });
  }, [
    createOrganizationAction?.label,
    openSetupTransactionModal,
    returnedState.createOrganization,
    runCreateOrganizationAction,
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
        run: () => runCreateBodyAction(actionId),
        title: action?.label ?? "Create body",
        transaction:
          returnedState.createBodies[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
    },
    [
      createBodyActions,
      openSetupTransactionModal,
      returnedState.createBodies,
      runCreateBodyAction,
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
        run: () => runCreateRoleAction(actionId),
        title: action?.label ?? "Create role",
        transaction:
          returnedState.createRoles[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
    },
    [
      createRoleActions,
      openSetupTransactionModal,
      returnedState.createRoles,
      runCreateRoleAction,
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
        run: () => runAssignMandateAction(actionId),
        title: action?.label ?? "Assign mandate",
        transaction:
          returnedState.assignMandates[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
    },
    [
      assignMandateActions,
      openSetupTransactionModal,
      returnedState.assignMandates,
      runAssignMandateAction,
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
        run: () => runSetPolicyRuleAction(actionId),
        title: action?.label ?? "Set policy rule",
        transaction:
          returnedState.setPolicyRules[actionId] ??
          createIdleSetupActionTransaction(actionId, action?.kind),
      });
    },
    [
      openSetupTransactionModal,
      returnedState.setPolicyRules,
      runSetPolicyRuleAction,
      setPolicyRuleActions,
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
