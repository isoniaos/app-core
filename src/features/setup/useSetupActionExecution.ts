import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetupAction, SetupDraft } from "@isonia/types";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useRuntimeConfig } from "../../config/runtime-config";
import {
  useTransactionModal,
  type TransactionFlowItem,
  type TransactionFlowItemStage,
  type TransactionFlowItemPatch,
  type TransactionFlowStage,
} from "../../transactions";
import { useWalletConnection } from "../../wallet/useWalletConnection";
import { canExecuteActivationActionState } from "./activation/activation-group-progress";
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
  normalizeTransactionError,
} from "./setup-action-execution-helpers";
import {
  deriveSetupExecutionStateFromReadModels,
  verifySetupCompletion,
  type SetupCompletionReadModels,
} from "./setup-completion-verification";
import {
  getSetupActionExecutionPreflight,
  type SetupActionExecutionPreflight,
  type SetupActionExecutionPreflightEnvironment,
} from "./setup-action-preflight";
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
  readonly executeAssignMandateGroup: () => Promise<void>;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateBodyGroup: () => Promise<void>;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly executeCreateRoleGroup: () => Promise<void>;
  readonly executeSetPolicyRule: (actionId: string) => Promise<void>;
  readonly executeSetPolicyRuleGroup: () => Promise<void>;
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
    openSerial: openSerialTransactionModal,
    openSingle: openTransactionModal,
    reset: resetTransactionModal,
    setActiveItem: setActiveTransactionModalItem,
    state: transactionModalState,
    updateItem: updateTransactionModalItem,
  } = useTransactionModal();
  const activeTransactionModalItemId = useRef<string | undefined>(undefined);
  const [state, setState] = useState<SetupDraftExecutionState>(
    createInitialSetupDraftExecutionState,
  );
  const stateRef = useRef<SetupDraftExecutionState>(state);
  const draftRef = useRef<SetupDraft>(draft);
  const readModelsRef = useRef<SetupCompletionReadModels | undefined>(
    readModels,
  );
  const setExecutionState = useCallback(
    (updater: (current: SetupDraftExecutionState) => SetupDraftExecutionState) => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setState(next);
    },
    [],
  );
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    readModelsRef.current = readModels;
  }, [readModels]);

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
  useEffect(() => {
    stateRef.current = returnedState;
  }, [returnedState]);

  const setupWritesEnabled =
    runtimeConfig.features.writeActions && runtimeConfig.features.manageOrg;

  useEffect(() => {
    if (!transactionModalState.open) {
      return;
    }

    if (transactionModalState.mode === "serial") {
      transactionModalState.items.forEach((item) => {
        if (!isSetupTransactionModalItemId(item.id)) {
          return;
        }

        const patch = buildSetupTransactionModalItemPatch({
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          draft,
          executionState: returnedState,
          itemId: item.id,
          readModels,
          serial: true,
        });
        if (patch) {
          updateTransactionModalItem(item.id, patch);
        }
      });
      return;
    }

    const activeItemId = activeTransactionModalItemId.current;
    if (activeItemId && isSetupTransactionModalItemId(activeItemId)) {
      const patch = buildSetupTransactionModalItemPatch({
        blockExplorerUrl: runtimeConfig.blockExplorerUrl,
        draft,
        executionState: returnedState,
        itemId: activeItemId,
        readModels,
        serial: false,
      });
      if (patch) {
        updateTransactionModalItem(activeItemId, patch);
      }
    }
  }, [
    draft,
    readModels,
    returnedState,
    runtimeConfig.blockExplorerUrl,
    transactionModalState.mode,
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
      setState: setExecutionState,
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
      setExecutionState,
      setupWritesEnabled,
      writeContractAsync,
    ],
  );
  const executorContextRef =
    useRef<SetupActionExecutorContext>(executorContext);
  useEffect(() => {
    executorContextRef.current = executorContext;
  }, [executorContext]);

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
    const next = createInitialSetupDraftExecutionState();
    stateRef.current = next;
    setState(next);
  }, [resetTransactionModal]);

  const startSetupTransaction = useCallback(
    async (itemId: string, run: () => Promise<void>): Promise<void> => {
      activeTransactionModalItemId.current = itemId;
      setActiveTransactionModalItem(itemId);
      updateTransactionModalItem(itemId, {
        error: undefined,
        stage: "preparing",
      });
      await run();
    },
    [setActiveTransactionModalItem, updateTransactionModalItem],
  );

  const openSetupTransactionModal = useCallback(
    ({
      action,
      description,
      itemId,
      run,
      title,
      transaction,
    }: {
      readonly action?: SetupAction;
      readonly description: string;
      readonly itemId: string;
      readonly run: () => Promise<void>;
      readonly title: string;
      readonly transaction: SetupActionTransaction;
    }) => {
      activeTransactionModalItemId.current = itemId;
      const preflight = action
        ? getSetupActionExecutionPreflight(action, {
            accountChainId: account.chainId,
            connected: account.isConnected,
            connectedAddress: account.address,
            govCoreAddress: runtimeConfig.contracts.govCoreAddress,
            runtimeChainId: runtimeConfig.chainId,
            setupWritesEnabled,
          })
        : undefined;
      const preflightReady = preflight?.canExecute ?? true;
      const start = () => startSetupTransaction(itemId, run);
      openTransactionModal({
        description,
        item: {
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          description,
          error: preflightReady
            ? transaction.error
            : preflight
              ? formatSetupPreflightError(preflight)
              : undefined,
          execute: preflightReady ? start : undefined,
          id: itemId,
          retry: preflightReady ? start : undefined,
          stage: preflightReady
            ? mapSetupLifecycleStageToTransactionFlowStage(
                transaction.stage,
                "idle",
              )
            : "failed",
          title,
          txHash: transaction.txHash,
        },
        title,
      });
    },
    [
      account.address,
      account.chainId,
      account.isConnected,
      openTransactionModal,
      runtimeConfig.blockExplorerUrl,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setupWritesEnabled,
      startSetupTransaction,
    ],
  );

  const runCreateOrganizationAction = useCallback(async (): Promise<void> => {
    await executeCreateOrganizationAction({
      action: createOrganizationAction,
      context: executorContextRef.current,
    });
  }, [createOrganizationAction]);

  const runCreateBodyAction = useCallback(
    async (actionId: string): Promise<void> => {
      const latestState = stateRef.current;
      await executeCreateBodyAction({
        actionId,
        actions: createBodyActions,
        context: executorContextRef.current,
        resolvedBodyIds: latestState.resolvedBodyIds,
        resolvedOrgId: latestState.resolvedOrgId ?? resolvedOrgId,
      });
    },
    [createBodyActions, resolvedOrgId],
  );

  const runCreateRoleAction = useCallback(
    async (actionId: string): Promise<void> => {
      const latestState = stateRef.current;
      await executeCreateRoleAction({
        actionId,
        actions: createRoleActions,
        bodyActions: createBodyActions,
        busy,
        context: executorContextRef.current,
        resolvedBodyIds: latestState.resolvedBodyIds,
        resolvedOrgId: latestState.resolvedOrgId ?? resolvedOrgId,
        resolvedRoleIds: latestState.resolvedRoleIds,
      });
    },
    [busy, createBodyActions, createRoleActions, resolvedOrgId],
  );

  const runAssignMandateAction = useCallback(
    async (actionId: string): Promise<void> => {
      const latestState = stateRef.current;
      await executeAssignMandateAction({
        actionId,
        actions: assignMandateActions,
        busy,
        context: executorContextRef.current,
        resolvedMandateIds: latestState.resolvedMandateIds,
        resolvedOrgId: latestState.resolvedOrgId ?? resolvedOrgId,
        resolvedRoleIds: latestState.resolvedRoleIds,
        resolvedRoles: latestState.resolvedRoles,
        roleActions: createRoleActions,
      });
    },
    [assignMandateActions, busy, createRoleActions, resolvedOrgId],
  );

  const runSetPolicyRuleAction = useCallback(
    async (actionId: string): Promise<void> => {
      const latestState = stateRef.current;
      await executeSetPolicyRuleAction({
        actionId,
        actions: setPolicyRuleActions,
        bodyActions: createBodyActions,
        busy,
        context: executorContextRef.current,
        mandateActions: assignMandateActions,
        resolvedBodyIds: latestState.resolvedBodyIds,
        resolvedMandateIds: latestState.resolvedMandateIds,
        resolvedOrgId: latestState.resolvedOrgId ?? resolvedOrgId,
        resolvedPolicyVersions: latestState.resolvedPolicyVersions,
        roleActions: createRoleActions,
      });
    },
    [
      assignMandateActions,
      busy,
      createBodyActions,
      createRoleActions,
      resolvedOrgId,
      setPolicyRuleActions,
    ],
  );

  const executeCreateOrganization = useCallback(async (): Promise<void> => {
    const itemId = SETUP_CREATE_ORGANIZATION_MODAL_ITEM_ID;
    openSetupTransactionModal({
      action: createOrganizationAction,
      description:
        "Submit the organization setup action, wait for the chain receipt, then wait for Control Plane to index the organization read model.",
      itemId,
      run: runCreateOrganizationAction,
      title: createOrganizationAction?.label ?? "Create organization",
      transaction: returnedState.createOrganization,
    });
  }, [
    createOrganizationAction,
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
        action,
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
        action,
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
        action,
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
        action,
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

  const runSetupGroupTransactions = useCallback(
    async ({
      actions,
      getItemId,
      runAction,
      startActionId,
    }: SetupGroupRunConfig): Promise<void> => {
      const startIndex = Math.max(
        0,
        startActionId
          ? actions.findIndex((action) => action.actionId === startActionId)
          : actions.findIndex((action) => {
              const result = getCompletionResult(
                action.actionId,
                draftRef.current,
                stateRef.current,
                readModelsRef.current,
              );
              return result?.state !== "indexed";
            }),
      );

      for (const action of actions.slice(startIndex)) {
        const itemId = getItemId(action.actionId);
        const result = getCompletionResult(
          action.actionId,
          draftRef.current,
          stateRef.current,
          readModelsRef.current,
        );

        if (result?.state === "indexed") {
          updateTransactionModalItem(itemId, {
            error: undefined,
            stage: "completed",
          });
          continue;
        }

        if (!canExecuteActivationActionState(result?.state)) {
          updateTransactionModalItem(itemId, {
            error: result?.message ?? "This setup action is blocked.",
            stage: "failed",
          });
          break;
        }

        const preflight = getSetupActionExecutionPreflight(action, {
          ...getSetupPreflightEnvironment(executorContextRef.current),
        });
        if (!preflight.canExecute) {
          updateTransactionModalItem(itemId, {
            error: formatSetupPreflightError(preflight),
            stage: "failed",
          });
          break;
        }

        activeTransactionModalItemId.current = itemId;
        setActiveTransactionModalItem(itemId);
        updateTransactionModalItem(itemId, {
          error: undefined,
          stage: "preparing",
        });

        try {
          await runAction(action.actionId);
        } catch (error: unknown) {
          const transaction = getSetupTransactionByModalItemId(
            itemId,
            stateRef.current,
          );
          updateTransactionModalItem(itemId, {
            error: normalizeTransactionError(error),
            stage: "failed",
            txHash: transaction?.txHash,
          });
          break;
        }

        const nextResult = getCompletionResult(
          action.actionId,
          draftRef.current,
          stateRef.current,
          readModelsRef.current,
        );
        const transaction = getSetupTransactionByModalItemId(
          itemId,
          stateRef.current,
        );

        if (
          nextResult?.state === "indexed" ||
          transaction?.stage === "indexed"
        ) {
          updateTransactionModalItem(itemId, {
            error: undefined,
            stage: "completed",
            txHash: transaction?.txHash ?? nextResult?.txHash,
          });
          continue;
        }

        if (
          nextResult?.state === "failed" ||
          transaction?.stage === "failed"
        ) {
          updateTransactionModalItem(itemId, {
            error:
              transaction?.error ??
              nextResult?.message ??
              "The setup action failed.",
            stage: "failed",
            txHash: transaction?.txHash ?? nextResult?.txHash,
          });
          break;
        }

        updateTransactionModalItem(itemId, {
          error: nextResult?.message,
          stage: transaction
            ? mapSetupLifecycleStageToSerialTransactionFlowStage(
                transaction.stage,
              )
            : "failed",
          txHash: transaction?.txHash ?? nextResult?.txHash,
        });
        break;
      }
    },
    [
      setActiveTransactionModalItem,
      updateTransactionModalItem,
    ],
  );

  const openSetupGroupTransactionModal = useCallback(
    ({
      actions,
      description,
      getItemId,
      runAction,
      title,
    }: SetupGroupModalConfig): void => {
      const firstActiveAction = actions.find((action) => {
        const result = getCompletionResult(
          action.actionId,
          draft,
          returnedState,
          readModels,
        );
        return result?.state !== "indexed";
      });
      const activeItemId = firstActiveAction
        ? getItemId(firstActiveAction.actionId)
        : undefined;
      const items = actions.map((action) =>
        createSetupGroupTransactionItem({
          action,
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          draft,
          executionState: returnedState,
          getItemId,
          readModels,
          runGroup: (startActionId) =>
            runSetupGroupTransactions({
              actions,
              getItemId,
              runAction,
              startActionId,
            }),
        }),
      );

      activeTransactionModalItemId.current = activeItemId;
      openSerialTransactionModal({
        activeItemId,
        description,
        items,
        title,
      });
    },
    [
      draft,
      openSerialTransactionModal,
      readModels,
      returnedState,
      runSetupGroupTransactions,
      runtimeConfig.blockExplorerUrl,
    ],
  );

  const executeCreateBodyGroup = useCallback(async (): Promise<void> => {
    openSetupGroupTransactionModal({
      actions: createBodyActions,
      description:
        "Create each governance body, waiting for receipt and Control Plane indexing before continuing.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("create-body", actionId),
      runAction: runCreateBodyAction,
      title: "Activate bodies",
    });
  }, [createBodyActions, openSetupGroupTransactionModal, runCreateBodyAction]);

  const executeCreateRoleGroup = useCallback(async (): Promise<void> => {
    openSetupGroupTransactionModal({
      actions: createRoleActions,
      description:
        "Create each role scope, waiting for receipt and Control Plane indexing before continuing.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("create-role", actionId),
      runAction: runCreateRoleAction,
      title: "Activate roles",
    });
  }, [createRoleActions, openSetupGroupTransactionModal, runCreateRoleAction]);

  const executeAssignMandateGroup = useCallback(async (): Promise<void> => {
    openSetupGroupTransactionModal({
      actions: assignMandateActions,
      description:
        "Assign each mandate holder, waiting for receipt and Control Plane indexing before continuing.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("assign-mandate", actionId),
      runAction: runAssignMandateAction,
      title: "Activate mandates",
    });
  }, [
    assignMandateActions,
    openSetupGroupTransactionModal,
    runAssignMandateAction,
  ]);

  const executeSetPolicyRuleGroup = useCallback(async (): Promise<void> => {
    openSetupGroupTransactionModal({
      actions: setPolicyRuleActions,
      description:
        "Set each policy route, waiting for receipt and Control Plane indexing before continuing.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("set-policy-rule", actionId),
      runAction: runSetPolicyRuleAction,
      title: "Activate policy routes",
    });
  }, [
    openSetupGroupTransactionModal,
    runSetPolicyRuleAction,
    setPolicyRuleActions,
  ]);

  return {
    busy,
    executeAssignMandate,
    executeAssignMandateGroup,
    executeCreateBody,
    executeCreateBodyGroup,
    executeCreateOrganization,
    executeCreateRole,
    executeCreateRoleGroup,
    executeSetPolicyRule,
    executeSetPolicyRuleGroup,
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

interface SetupGroupRunConfig {
  readonly actions: readonly SetupAction[];
  readonly getItemId: (actionId: string) => string;
  readonly runAction: (actionId: string) => Promise<void>;
  readonly startActionId?: string;
}

interface SetupGroupModalConfig
  extends Omit<SetupGroupRunConfig, "startActionId"> {
  readonly description: string;
  readonly title: string;
}

function buildSetupTransactionModalItemPatch({
  blockExplorerUrl,
  draft,
  executionState,
  itemId,
  readModels,
  serial,
}: {
  readonly blockExplorerUrl?: string;
  readonly draft: SetupDraft;
  readonly executionState: SetupDraftExecutionState;
  readonly itemId: string;
  readonly readModels?: SetupCompletionReadModels;
  readonly serial: boolean;
}): TransactionFlowItemPatch | undefined {
  const transaction = getEffectiveSetupTransaction(
    getSetupTransactionByModalItemId(itemId, executionState),
  );
  const actionId = parseSetupTransactionModalActionId(itemId);
  const result = actionId
    ? getCompletionResult(actionId, draft, executionState, readModels)
    : undefined;

  if (!serial && !transaction && result?.state !== "indexed") {
    return undefined;
  }

  return {
    blockExplorerUrl,
    error:
      transaction?.error ??
      (result?.state === "failed" ? result.message : undefined),
    stage: serial
      ? getSetupGroupTransactionItemStage(result?.state, transaction)
      : getSingleSetupTransactionItemStage(result?.state, transaction),
    txHash: transaction?.txHash ?? result?.txHash,
  };
}

function getEffectiveSetupTransaction(
  transaction: SetupActionTransaction | undefined,
): SetupActionTransaction | undefined {
  if (
    transaction?.stage === "idle" &&
    !transaction.actionId &&
    !transaction.txHash
  ) {
    return undefined;
  }

  return transaction;
}

function createSetupGroupTransactionItem({
  action,
  blockExplorerUrl,
  draft,
  executionState,
  getItemId,
  readModels,
  runGroup,
}: {
  readonly action: SetupAction;
  readonly blockExplorerUrl?: string;
  readonly draft: SetupDraft;
  readonly executionState: SetupDraftExecutionState;
  readonly getItemId: (actionId: string) => string;
  readonly readModels?: SetupCompletionReadModels;
  readonly runGroup: (startActionId: string) => Promise<void>;
}): TransactionFlowItem {
  const itemId = getItemId(action.actionId);
  const result = getCompletionResult(
    action.actionId,
    draft,
    executionState,
    readModels,
  );
  const transaction = getSetupTransactionByModalItemId(itemId, executionState);
  const stage = getSetupGroupTransactionItemStage(result?.state, transaction);
  const run = () => runGroup(action.actionId);

  return {
    blockExplorerUrl,
    description: action.description,
    error:
      transaction?.error ??
      (result?.state === "failed" ? result.message : undefined),
    execute: stage !== "completed" ? run : undefined,
    id: itemId,
    retry: stage !== "completed" ? run : undefined,
    stage,
    title: action.label,
    txHash: transaction?.txHash ?? result?.txHash,
  };
}

function buildSetupTransactionModalItemId(
  kind: SetupModalActionKind,
  actionId: string,
): string {
  return `setup:${kind}:${actionId}`;
}

function isSetupTransactionModalItemId(itemId: string): boolean {
  return (
    itemId === SETUP_CREATE_ORGANIZATION_MODAL_ITEM_ID ||
    parseSetupTransactionModalActionId(itemId) !== undefined
  );
}

function parseSetupTransactionModalActionId(
  itemId: string,
): string | undefined {
  return (
    parseSetupTransactionModalItemId(itemId, "create-body") ??
    parseSetupTransactionModalItemId(itemId, "create-role") ??
    parseSetupTransactionModalItemId(itemId, "assign-mandate") ??
    parseSetupTransactionModalItemId(itemId, "set-policy-rule")
  );
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

function mapSetupLifecycleStageToSerialTransactionFlowStage(
  stage: SetupActionLifecycleStage,
): TransactionFlowItemStage {
  switch (stage) {
    case "idle":
      return "pending";
    case "wallet_pending":
      return "waiting_for_wallet";
    case "submitted":
      return "submitted";
    case "confirming":
      return "waiting_for_receipt";
    case "confirmed_waiting_indexer":
      return "waiting_for_control_plane";
    case "indexed":
      return "completed";
    case "failed":
      return "failed";
  }
}

function getSetupGroupTransactionItemStage(
  resultState: ReturnType<
    typeof verifySetupCompletion
  >["actionResults"][number]["state"] | undefined,
  transaction: SetupActionTransaction | undefined,
): TransactionFlowItemStage {
  if (resultState === "indexed") {
    return "completed";
  }

  if (transaction && transaction.stage !== "idle") {
    return mapSetupLifecycleStageToSerialTransactionFlowStage(
      transaction.stage,
    );
  }

  if (resultState === "failed") {
    return "failed";
  }

  return "pending";
}

function getSingleSetupTransactionItemStage(
  resultState: ReturnType<
    typeof verifySetupCompletion
  >["actionResults"][number]["state"] | undefined,
  transaction: SetupActionTransaction | undefined,
): TransactionFlowStage {
  if (resultState === "indexed") {
    return "completed";
  }

  if (transaction) {
    return mapSetupLifecycleStageToTransactionFlowStage(
      transaction.stage,
      "idle",
    );
  }

  if (resultState === "failed") {
    return "failed";
  }

  return "idle";
}

function getSetupPreflightEnvironment(
  context: SetupActionExecutorContext,
): SetupActionExecutionPreflightEnvironment {
  return {
    accountChainId: context.account.chainId,
    connected: context.account.isConnected,
    connectedAddress: context.account.address,
    govCoreAddress: context.runtimeConfig.contracts.govCoreAddress,
    runtimeChainId: context.runtimeConfig.chainId,
    setupWritesEnabled: context.setupWritesEnabled,
  };
}

function formatSetupPreflightError(
  preflight: SetupActionExecutionPreflight,
): string {
  const expected = preflight.expectedSignerAddress ?? "unavailable";
  const connected = preflight.connectedSignerAddress ?? "not connected";
  return `${preflight.message} Expected admin: ${expected}. Connected wallet: ${connected}.`;
}

function getCompletionResult(
  actionId: string,
  draft: SetupDraft,
  executionState: SetupDraftExecutionState,
  readModels: SetupCompletionReadModels | undefined,
): ReturnType<typeof verifySetupCompletion>["actionResults"][number] | undefined {
  return verifySetupCompletion({
    draft,
    executionState,
    readModels,
  }).actionResults.find((result) => result.actionId === actionId);
}
