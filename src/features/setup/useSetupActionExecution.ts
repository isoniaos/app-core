import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivationCapabilities,
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
  SetupDraft,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import {
  createAdminBatchActivationPlan,
  getAdminBatchActivationFunctionName,
  isContractBatchActivationMode,
  type AdminBatchActivationPlanCall,
  type AssignMandatesActivationPlanCall,
  type CreateBodiesActivationPlanCall,
  type CreateRolesActivationPlanCall,
  type IsoniaControlPlaneClient,
  type SetPolicyRulesActivationPlanCall,
} from "@isonia/sdk";
import { usePublicClient, useWriteContract } from "wagmi";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { GOV_CORE_ABI } from "../../chain/setup-contracts";
import { useRuntimeConfig } from "../../config/runtime-config";
import {
  useTransactionModal,
  type TransactionBatchDetails,
  type TransactionFlowItem,
  type TransactionFlowItemStage,
  type TransactionFlowItemPatch,
  type TransactionFlowStage,
} from "../../transactions";
import type { PreparedContractCall } from "../../transactions/prepared-contract-call";
import {
  extractEip5792TransactionHashes,
  formatEip5792Error,
  getEip5792MethodError,
  getEip5792ProviderContext,
  isSuccessfulCallsStatus,
  pollEip5792CallsStatus,
  sendEip5792Calls,
  type Eip5792CapabilityDetection,
} from "../../wallet/eip5792";
import { useEip5792Capabilities } from "../../wallet/useEip5792Capabilities";
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
  delay,
  isConfiguredAddress,
  isBusyStage,
  normalizeTransactionError,
  resolveRoleReference,
} from "./setup-action-execution-helpers";
import { assertSuccessfulReceipt } from "./receipt-parsers";
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
  type SetupExecutionStateUpdater,
} from "./setup-action-execution-types";
import {
  assertPolicyDependenciesResolved,
  buildBatchAssignMandatesCallArgs,
  buildBatchAssignMandatesInput,
  buildBatchCreateBodiesCallArgs,
  buildBatchCreateBodiesInput,
  buildBatchCreateRolesCallArgs,
  buildBatchCreateRolesInput,
  buildBatchSetPolicyRulesCallArgs,
  buildBatchSetPolicyRulesInput,
  prepareAssignMandateCall,
  prepareCreateBodyCall,
  prepareCreateRoleCall,
  prepareSetPolicyRuleCall,
  type PreparedActivationCall,
} from "./setup-prepared-calls";
import { getReadiness } from "./setup-action-readiness";

export type {
  SetupActionLifecycleStage,
  SetupActionReadiness,
  SetupActionTransaction,
  SetupDraftExecutionState,
} from "./setup-action-execution-types";

interface UseSetupActionExecutionOptions {
  readonly activationCapabilities?: ActivationCapabilities;
  readonly draft: SetupDraft;
  readonly readModels?: SetupCompletionReadModels;
}

export function useSetupActionExecution({
  activationCapabilities,
  draft,
  readModels,
}: UseSetupActionExecutionOptions): {
  readonly busy: boolean;
  readonly eip5792BatchCapability: Eip5792CapabilityDetection;
  readonly eip5792BatchChecking: boolean;
  readonly eip5792BatchFeatureEnabled: boolean;
  readonly refreshEip5792BatchCapability: () => Promise<Eip5792CapabilityDetection>;
  readonly executeAssignMandate: (actionId: string) => Promise<void>;
  readonly executeAssignMandateGroupBatch: () => Promise<void>;
  readonly executeAssignMandateGroup: () => Promise<void>;
  readonly executeCreateBody: (actionId: string) => Promise<void>;
  readonly executeCreateBodyGroupBatch: () => Promise<void>;
  readonly executeCreateBodyGroup: () => Promise<void>;
  readonly executeCreateOrganization: () => Promise<void>;
  readonly executeCreateRole: (actionId: string) => Promise<void>;
  readonly executeCreateRoleGroupBatch: () => Promise<void>;
  readonly executeCreateRoleGroup: () => Promise<void>;
  readonly executeSetPolicyRule: (actionId: string) => Promise<void>;
  readonly executeSetPolicyRuleGroupBatch: () => Promise<void>;
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
    openBatch: openBatchTransactionModal,
    openSerial: openSerialTransactionModal,
    openSingle: openTransactionModal,
    reset: resetTransactionModal,
    setActiveItem: setActiveTransactionModalItem,
    state: transactionModalState,
    updateBatch: updateTransactionBatch,
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
  const eip5792BatchFeatureEnabled =
    setupWritesEnabled && runtimeConfig.features.eip5792Batch;
  const {
    capabilities: eip5792BatchCapability,
    checking: eip5792BatchChecking,
    refresh: refreshEip5792BatchCapability,
  } = useEip5792Capabilities({
    accountChainId: account.chainId,
    address: account.address,
    chainId: runtimeConfig.chainId,
    connected: account.isConnected,
    connector: account.connector,
    enabled: eip5792BatchFeatureEnabled,
  });

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

    if (transactionModalState.mode === "batch") {
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

  const runSetupGroupBatchTransactions = useCallback(
    async ({
      actions,
      calls,
      getItemId,
    }: SetupGroupBatchRunConfig): Promise<void> => {
      const providerContext = await getEip5792ProviderContext(account.connector);
      const provider = providerContext.provider;
      const errorContext = {
        chainId: runtimeConfig.chainId,
        connectorName:
          providerContext.diagnostics.connector.name ??
          providerContext.diagnostics.connector.id,
        providerName: providerContext.diagnostics.providerLabel,
      };
      if (!provider || !account.address) {
        const message = "Wallet provider is unavailable for EIP-5792 batching.";
        updateTransactionBatch({
          error: message,
          lastMethodError: undefined,
          status: "failed",
          statusDetail:
            "The batch was not submitted. Use the serial fallback for this activation group.",
        });
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "failed",
          error: message,
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            error: message,
            stage: "failed",
          },
          updateTransactionModalItem,
        });
        return;
      }

      if (!eip5792BatchCapability.canSendCalls) {
        const message = eip5792BatchCapability.reason;
        updateTransactionBatch({
          error: message,
          lastMethodError: eip5792BatchCapability.lastMethodError,
          status: "failed",
          statusDetail:
            "The batch was not submitted. Use the serial fallback for this activation group.",
        });
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "failed",
          error: message,
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            error: message,
            stage: "failed",
          },
          updateTransactionModalItem,
        });
        return;
      }

      let batchSubmitted = false;

      try {
        updateTransactionBatch({
          error: undefined,
          lastMethodError: undefined,
          status: "waiting_for_wallet",
          statusDetail: "Confirm the wallet batch request.",
        });
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "wallet_pending",
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            error: undefined,
            stage: "waiting_for_wallet",
          },
          updateTransactionModalItem,
        });

        const sendResult = await sendEip5792Calls({
          atomicRequired: eip5792BatchCapability.atomicRequired,
          calls,
          context: errorContext,
          from: account.address,
          provider,
        });
        batchSubmitted = true;

        updateTransactionBatch({
          batchId: sendResult.id,
          status: "submitted",
          statusDetail: "Wallet accepted the batch request.",
        });
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "submitted",
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            stage: "submitted",
          },
          updateTransactionModalItem,
        });

        updateTransactionBatch({
          status: "waiting_for_status",
          statusDetail: "Waiting for wallet_getCallsStatus.",
        });
        const terminalStatus = await pollEip5792CallsStatus({
          context: errorContext,
          id: sendResult.id,
          onStatus: (status) => {
            const txHashes = extractEip5792TransactionHashes(status);
            updateTransactionBatch({
              status: "waiting_for_status",
              txHashes,
              walletAtomic: status.atomic,
              walletStatusCode: status.status,
            });
            updateBatchModalItemHashes({
              actions,
              getItemId,
              txHashes,
              updateTransactionModalItem,
            });
          },
          provider,
        });
        const txHashes = extractEip5792TransactionHashes(terminalStatus);
        updateTransactionBatch({
          txHashes,
          walletAtomic: terminalStatus.atomic,
          walletStatusCode: terminalStatus.status,
        });
        updateBatchModalItemHashes({
          actions,
          getItemId,
          txHashes,
          updateTransactionModalItem,
        });

        if (!isSuccessfulCallsStatus(terminalStatus)) {
          const message = `Wallet reported batch status ${terminalStatus.status}.`;
          applyBatchActionTransactionPatch({
            actions,
            setState: setExecutionState,
            stage: "failed",
            error: message,
            txHashes,
          });
          updateTransactionBatch({
            error: message,
            status: "failed",
            statusDetail:
              "Some calls may already be indexed. Refresh read models before continuing incomplete actions one by one.",
          });
          await refreshBatchReadModelProgress({
            actions,
            client,
            draft: draftRef.current,
            getExecutionState: () => stateRef.current,
            getItemId,
            orgId: stateRef.current.resolvedOrgId ?? resolvedOrgId,
            readModels: readModelsRef.current,
            setExecutionState,
            updateTransactionModalItem,
          });
          return;
        }

        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "confirmed_waiting_indexer",
          txHashes,
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            stage: "waiting_for_control_plane",
          },
          updateTransactionModalItem,
        });
        updateBatchModalItemHashes({
          actions,
          getItemId,
          txHashes,
          updateTransactionModalItem,
        });
        updateTransactionBatch({
          status: "waiting_for_control_plane",
          statusDetail:
            "Wallet reports batch success. Waiting for indexed activation read models.",
        });

        await waitForBatchReadModelCompletion({
          actions,
          client,
          draft: draftRef.current,
          getExecutionState: () => stateRef.current,
          getItemId,
          orgId: stateRef.current.resolvedOrgId ?? resolvedOrgId,
          readModels: readModelsRef.current,
          setExecutionState,
          updateTransactionModalItem,
        });

        updateTransactionBatch({
          error: undefined,
          status: "completed",
          statusDetail:
            "All expected activation read models are indexed for this batch.",
        });
      } catch (error: unknown) {
        const lastMethodError = getEip5792MethodError(error);
        const message = formatEip5792Error(error, errorContext);
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "failed",
          error: message,
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            error: message,
            stage: "failed",
          },
          updateTransactionModalItem,
        });
        updateTransactionBatch({
          error: message,
          lastMethodError,
          status: "failed",
          statusDetail: batchSubmitted
            ? "The wallet accepted the batch, but App Core could not finish status tracking. Check wallet UI and indexed progress before retrying incomplete actions."
            : "The batch was not submitted. Use the serial fallback for this activation group.",
        });
      }
    },
    [
      account.address,
      account.connector,
      client,
      eip5792BatchCapability.atomicRequired,
      eip5792BatchCapability.canSendCalls,
      eip5792BatchCapability.reason,
      resolvedOrgId,
      runtimeConfig.chainId,
      setExecutionState,
      updateTransactionBatch,
      updateTransactionModalItem,
    ],
  );

  const submitContractBatchPlanCall = useCallback(
    async (call: AdminBatchActivationPlanCall): Promise<`0x${string}`> => {
      const signerAddress = account.address;
      if (!signerAddress) {
        throw new Error("Wallet is not connected.");
      }

      switch (call.group) {
        case "bodies": {
          const args = buildBatchCreateBodiesCallArgs({
            orgId: call.orgId,
            inputs: call.inputs,
          });
          if (args instanceof Error) {
            throw args;
          }
          return await writeContractAsync({
            address: runtimeConfig.contracts.govCoreAddress,
            abi: GOV_CORE_ABI,
            functionName: getAdminBatchActivationFunctionName("bodies"),
            args,
            chainId: runtimeConfig.chainId,
            account: signerAddress,
          });
        }
        case "roles": {
          const args = buildBatchCreateRolesCallArgs({
            orgId: call.orgId,
            inputs: call.inputs,
          });
          if (args instanceof Error) {
            throw args;
          }
          return await writeContractAsync({
            address: runtimeConfig.contracts.govCoreAddress,
            abi: GOV_CORE_ABI,
            functionName: getAdminBatchActivationFunctionName("roles"),
            args,
            chainId: runtimeConfig.chainId,
            account: signerAddress,
          });
        }
        case "mandates": {
          const args = buildBatchAssignMandatesCallArgs({
            orgId: call.orgId,
            inputs: call.inputs,
          });
          if (args instanceof Error) {
            throw args;
          }
          return await writeContractAsync({
            address: runtimeConfig.contracts.govCoreAddress,
            abi: GOV_CORE_ABI,
            functionName: getAdminBatchActivationFunctionName("mandates"),
            args,
            chainId: runtimeConfig.chainId,
            account: signerAddress,
          });
        }
        case "policyRules": {
          const args = buildBatchSetPolicyRulesCallArgs({
            orgId: call.orgId,
            inputs: call.inputs,
          });
          if (args instanceof Error) {
            throw args;
          }
          return await writeContractAsync({
            address: runtimeConfig.contracts.govCoreAddress,
            abi: GOV_CORE_ABI,
            functionName: getAdminBatchActivationFunctionName("policyRules"),
            args,
            chainId: runtimeConfig.chainId,
            account: signerAddress,
          });
        }
      }
      throw new Error("Unsupported contract batch group.");
    },
    [
      account.address,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      writeContractAsync,
    ],
  );

  const runSetupGroupContractBatchTransaction = useCallback(
    async ({
      actions,
      call,
      getItemId,
    }: SetupGroupContractBatchRunConfig): Promise<void> => {
      const failBatch = (message: string, txHash?: `0x${string}`): void => {
        applyBatchActionTransactionPatch({
          actions,
          error: message,
          setState: setExecutionState,
          stage: "failed",
          txHashes: txHash ? [txHash] : [],
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            error: message,
            stage: "failed",
            txHash,
          },
          updateTransactionModalItem,
        });
        updateTransactionBatch({
          error: message,
          status: "failed",
          statusDetail:
            "The typed contract batch did not complete. Use the serial fallback for incomplete actions after checking indexed progress.",
          txHashes: txHash ? [txHash] : [],
        });
      };

      if (!account.address) {
        failBatch("Wallet is not connected.");
        return;
      }

      if (account.chainId !== runtimeConfig.chainId) {
        failBatch(
          `Wallet is connected to chain ${String(
            account.chainId,
          )}; expected chain ${runtimeConfig.chainId}.`,
        );
        return;
      }

      if (!isConfiguredAddress(runtimeConfig.contracts.govCoreAddress)) {
        failBatch("GovCore contract address is missing from runtime config.");
        return;
      }

      if (!publicClient) {
        failBatch("Wallet client is unavailable for the configured chain.");
        return;
      }

      let txHash: `0x${string}` | undefined;

      try {
        updateTransactionBatch({
          error: undefined,
          status: "waiting_for_wallet",
          statusDetail: "Confirm the typed GovCore batch transaction.",
        });
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "wallet_pending",
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            error: undefined,
            stage: "waiting_for_wallet",
          },
          updateTransactionModalItem,
        });

        txHash = await submitContractBatchPlanCall(call);

        updateTransactionBatch({
          status: "submitted",
          statusDetail:
            "Batch transaction submitted. Waiting for receipt confirmation.",
          txHashes: [txHash],
        });
        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "submitted",
          txHashes: [txHash],
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            stage: "submitted",
            txHash,
          },
          updateTransactionModalItem,
        });

        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "confirming",
          txHashes: [txHash],
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            stage: "confirming",
            txHash,
          },
          updateTransactionModalItem,
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        assertSuccessfulReceipt(receipt);

        applyBatchActionTransactionPatch({
          actions,
          setState: setExecutionState,
          stage: "confirmed_waiting_indexer",
          txHashes: [txHash],
        });
        updateBatchModalItems({
          actions,
          getItemId,
          patch: {
            stage: "waiting_for_control_plane",
            txHash,
          },
          updateTransactionModalItem,
        });
        updateTransactionBatch({
          status: "waiting_for_control_plane",
          statusDetail:
            "Contract batch confirmed. Waiting for indexed activation read models.",
          txHashes: [txHash],
        });

        await waitForBatchReadModelCompletion({
          actions,
          client,
          draft: draftRef.current,
          getExecutionState: () => stateRef.current,
          getItemId,
          orgId: stateRef.current.resolvedOrgId ?? resolvedOrgId,
          readModels: readModelsRef.current,
          setExecutionState,
          updateTransactionModalItem,
        });

        updateTransactionBatch({
          error: undefined,
          status: "completed",
          statusDetail:
            "All expected activation read models are indexed for this contract batch.",
          txHashes: [txHash],
        });
      } catch (error: unknown) {
        failBatch(normalizeTransactionError(error), txHash);
      }
    },
    [
      account.address,
      account.chainId,
      client,
      publicClient,
      resolvedOrgId,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
      setExecutionState,
      submitContractBatchPlanCall,
      updateTransactionBatch,
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

  const openSetupGroupBatchTransactionModal = useCallback(
    ({
      actions,
      description,
      getItemId,
      prepareCall,
      runSerialFallback,
      title,
    }: SetupGroupBatchModalConfig): void => {
      const runnableActions = actions.filter((action) => {
        const result = getCompletionResult(
          action.actionId,
          draft,
          returnedState,
          readModels,
        );
        return (
          result?.state !== "indexed" &&
          canExecuteActivationActionState(result?.state)
        );
      });
      const prepared: PreparedActivationCall[] = [];
      let preparationError: Error | undefined;

      for (const action of runnableActions) {
        const preflight = getSetupActionExecutionPreflight(action, {
          ...getSetupPreflightEnvironment(executorContextRef.current),
        });
        if (!preflight.canExecute) {
          preparationError = new Error(formatSetupPreflightError(preflight));
          break;
        }

        const preparedCall = prepareCall(action);
        if (preparedCall instanceof Error) {
          preparationError = preparedCall;
          break;
        }
        prepared.push(preparedCall);
      }

      const items = runnableActions.map((action, index) => {
        const itemId = getItemId(action.actionId);
        const failed = Boolean(preparationError && index >= prepared.length);
        return {
          blockExplorerUrl: runtimeConfig.blockExplorerUrl,
          description: action.description,
          error: failed ? preparationError?.message : undefined,
          id: itemId,
          stage: failed ? "failed" : "pending",
          title: action.label,
        } satisfies TransactionFlowItem;
      });

      const batchDetails: TransactionBatchDetails = {
        atomicCapability:
          eip5792BatchCapability.details?.atomicStatus ?? "Not reported",
        capabilityStatus: eip5792BatchCapability.status,
        capabilitySummary: eip5792BatchCapability.reason,
        error: preparationError?.message,
        lastMethodError: eip5792BatchCapability.lastMethodError,
        execute:
          !preparationError && prepared.length > 0
            ? () =>
                runSetupGroupBatchTransactions({
                  actions: runnableActions,
                  calls: prepared.map((item) => item.call),
                  getItemId,
                })
            : undefined,
        fallbackSerial: runSerialFallback,
        fallbackSerialLabel: "Run step one by one",
        kind: "wallet_eip5792",
        retry:
          !preparationError && prepared.length > 0
            ? () =>
                runSetupGroupBatchTransactions({
                  actions: runnableActions,
                  calls: prepared.map((item) => item.call),
                  getItemId,
                })
            : undefined,
        status: preparationError ? "failed" : "ready",
        statusDetail: preparationError
          ? "The batch was not submitted. Use the serial fallback for this activation group."
          : "Review the prepared calls, then execute the wallet batch.",
        txHashes: [],
      };

      activeTransactionModalItemId.current = items[0]?.id;
      openBatchTransactionModal({
        batch: batchDetails,
        description,
        items,
        title,
      });
    },
    [
      draft,
      eip5792BatchCapability.details?.atomicStatus,
      eip5792BatchCapability.lastMethodError,
      eip5792BatchCapability.reason,
      eip5792BatchCapability.status,
      openBatchTransactionModal,
      readModels,
      returnedState,
      runSetupGroupBatchTransactions,
      runtimeConfig.blockExplorerUrl,
    ],
  );

  const openSetupGroupContractBatchTransactionModal = useCallback(
    ({
      actions,
      call,
      description,
      getItemId,
      runSerialFallback,
      title,
    }: SetupGroupContractBatchModalConfig): void => {
      const runnableActions = actions.filter((action) => {
        const result = getCompletionResult(
          action.actionId,
          draft,
          returnedState,
          readModels,
        );
        return (
          result?.state !== "indexed" &&
          canExecuteActivationActionState(result?.state)
        );
      });
      let preparationError: Error | undefined;

      if (runnableActions.length === 0) {
        preparationError = new Error("No executable setup actions are pending.");
      }

      for (const action of runnableActions) {
        const preflight = getSetupActionExecutionPreflight(action, {
          ...getSetupPreflightEnvironment(executorContextRef.current),
        });
        if (!preflight.canExecute) {
          preparationError = new Error(formatSetupPreflightError(preflight));
          break;
        }
      }

      const items = runnableActions.map((action) => ({
        blockExplorerUrl: runtimeConfig.blockExplorerUrl,
        description: action.description,
        error: preparationError?.message,
        id: getItemId(action.actionId),
        stage: preparationError ? "failed" : "pending",
        title: action.label,
      })) satisfies readonly TransactionFlowItem[];

      const batchDetails: TransactionBatchDetails = {
        atomicCapability: "Single GovCore transaction",
        capabilityStatus: "supported",
        capabilitySummary: `${call.label}: ${call.itemCount.toLocaleString()} item${call.itemCount === 1 ? "" : "s"}.`,
        error: preparationError?.message,
        execute:
          !preparationError && runnableActions.length > 0
            ? () =>
                runSetupGroupContractBatchTransaction({
                  actions: runnableActions,
                  call,
                  getItemId,
                })
            : undefined,
        fallbackSerial: runSerialFallback,
        fallbackSerialLabel: "Run step one by one",
        kind: "contract_batch",
        retry:
          !preparationError && runnableActions.length > 0
            ? () =>
                runSetupGroupContractBatchTransaction({
                  actions: runnableActions,
                  call,
                  getItemId,
                })
            : undefined,
        status: preparationError ? "failed" : "ready",
        statusDetail: preparationError
          ? "The contract batch was not submitted. Use the serial fallback for this activation group."
          : "Review the typed contract batch, then submit one GovCore transaction.",
        txHashes: [],
      };

      activeTransactionModalItemId.current = items[0]?.id;
      openBatchTransactionModal({
        batch: batchDetails,
        description,
        items,
        title,
      });
    },
    [
      draft,
      openBatchTransactionModal,
      readModels,
      returnedState,
      runSetupGroupContractBatchTransaction,
      runtimeConfig.blockExplorerUrl,
    ],
  );

  const openCreateBodyGroupSerial = useCallback(async (): Promise<void> => {
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

  const executeCreateBodyGroup = useCallback(async (): Promise<void> => {
    const batchInput = buildBatchCreateBodiesInput({
      actions: createBodyActions,
      resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
    });
    if (!(batchInput instanceof Error)) {
      const plan = createAdminBatchActivationPlan({
        bodies: batchInput,
        capabilities: activationCapabilities,
      });
      const call = plan.calls.find(
        (candidate): candidate is CreateBodiesActivationPlanCall =>
          candidate.group === "bodies",
      );
      if (isContractBatchActivationMode(plan.executionMode) && call) {
        openSetupGroupContractBatchTransactionModal({
          actions: createBodyActions,
          call,
          description:
            "Submit one typed GovCore batch for ready body setup calls, then wait for indexed read models.",
          getItemId: (actionId) =>
            buildSetupTransactionModalItemId("create-body", actionId),
          runSerialFallback: () => openCreateBodyGroupSerial(),
          title: "Batch activate bodies",
        });
        return;
      }
    }

    await openCreateBodyGroupSerial();
  }, [
    activationCapabilities,
    createBodyActions,
    openCreateBodyGroupSerial,
    openSetupGroupContractBatchTransactionModal,
    resolvedOrgId,
  ]);

  const executeCreateBodyGroupBatch = useCallback(async (): Promise<void> => {
    openSetupGroupBatchTransactionModal({
      actions: createBodyActions,
      description:
        "Submit ready body setup calls as an EIP-5792 wallet batch, then wait for indexed read models.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("create-body", actionId),
      prepareCall: (action) =>
        prepareCreateBodyCall({
          action: action as CreateBodySetupAction,
          chainId: runtimeConfig.chainId,
          govCoreAddress: runtimeConfig.contracts.govCoreAddress,
          resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
        }),
      runSerialFallback: () => openCreateBodyGroupSerial(),
      title: "Batch activate bodies",
    });
  }, [
    createBodyActions,
    openCreateBodyGroupSerial,
    openSetupGroupBatchTransactionModal,
    resolvedOrgId,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
  ]);

  const openCreateRoleGroupSerial = useCallback(async (): Promise<void> => {
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

  const executeCreateRoleGroup = useCallback(async (): Promise<void> => {
    const batchInput = buildBatchCreateRolesInput({
      actions: createRoleActions,
      bodyActions: createBodyActions,
      resolvedBodyIds: stateRef.current.resolvedBodyIds,
      resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
    });
    if (!(batchInput instanceof Error)) {
      const plan = createAdminBatchActivationPlan({
        roles: batchInput,
        capabilities: activationCapabilities,
      });
      const call = plan.calls.find(
        (candidate): candidate is CreateRolesActivationPlanCall =>
          candidate.group === "roles",
      );
      if (isContractBatchActivationMode(plan.executionMode) && call) {
        openSetupGroupContractBatchTransactionModal({
          actions: createRoleActions,
          call,
          description:
            "Submit one typed GovCore batch for ready role setup calls, then wait for indexed read models.",
          getItemId: (actionId) =>
            buildSetupTransactionModalItemId("create-role", actionId),
          runSerialFallback: () => openCreateRoleGroupSerial(),
          title: "Batch activate roles",
        });
        return;
      }
    }

    await openCreateRoleGroupSerial();
  }, [
    activationCapabilities,
    createBodyActions,
    createRoleActions,
    openCreateRoleGroupSerial,
    openSetupGroupContractBatchTransactionModal,
    resolvedOrgId,
  ]);

  const executeCreateRoleGroupBatch = useCallback(async (): Promise<void> => {
    openSetupGroupBatchTransactionModal({
      actions: createRoleActions,
      description:
        "Submit ready role setup calls as an EIP-5792 wallet batch, then wait for indexed read models.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("create-role", actionId),
      prepareCall: (action) =>
        prepareCreateRoleCall({
          action: action as CreateRoleSetupAction,
          bodyActions: createBodyActions,
          chainId: runtimeConfig.chainId,
          govCoreAddress: runtimeConfig.contracts.govCoreAddress,
          resolvedBodyIds: stateRef.current.resolvedBodyIds,
          resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
        }),
      runSerialFallback: () => openCreateRoleGroupSerial(),
      title: "Batch activate roles",
    });
  }, [
    createBodyActions,
    createRoleActions,
    openCreateRoleGroupSerial,
    openSetupGroupBatchTransactionModal,
    resolvedOrgId,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
  ]);

  const openAssignMandateGroupSerial = useCallback(async (): Promise<void> => {
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

  const executeAssignMandateGroup = useCallback(async (): Promise<void> => {
    const batchInput = buildBatchAssignMandatesInput({
      actions: assignMandateActions,
      resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
      resolvedRoleIds: stateRef.current.resolvedRoleIds,
      roleActions: createRoleActions,
    });
    if (!(batchInput instanceof Error)) {
      const plan = createAdminBatchActivationPlan({
        mandates: batchInput,
        capabilities: activationCapabilities,
      });
      const call = plan.calls.find(
        (candidate): candidate is AssignMandatesActivationPlanCall =>
          candidate.group === "mandates",
      );
      if (isContractBatchActivationMode(plan.executionMode) && call) {
        openSetupGroupContractBatchTransactionModal({
          actions: assignMandateActions,
          call,
          description:
            "Submit one typed GovCore batch for ready mandate setup calls, then wait for indexed read models.",
          getItemId: (actionId) =>
            buildSetupTransactionModalItemId("assign-mandate", actionId),
          runSerialFallback: () => openAssignMandateGroupSerial(),
          title: "Batch activate mandates",
        });
        return;
      }
    }

    await openAssignMandateGroupSerial();
  }, [
    activationCapabilities,
    assignMandateActions,
    createRoleActions,
    openAssignMandateGroupSerial,
    openSetupGroupContractBatchTransactionModal,
    resolvedOrgId,
  ]);

  const executeAssignMandateGroupBatch = useCallback(async (): Promise<void> => {
    openSetupGroupBatchTransactionModal({
      actions: assignMandateActions,
      description:
        "Submit ready mandate setup calls as an EIP-5792 wallet batch, then wait for indexed read models.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("assign-mandate", actionId),
      prepareCall: (action) => {
        const mandateAction = action as AssignMandateSetupAction;
        const resolvedRoleId = resolveRoleReference({
          reference: mandateAction.roleRef,
          resolvedRoleIds: stateRef.current.resolvedRoleIds,
          roleActions: createRoleActions,
        });
        if (!resolvedRoleId) {
          return new Error(
            "Assign mandate is blocked until the referenced role is indexed and the real roleId is resolved.",
          );
        }
        return prepareAssignMandateCall({
          action: mandateAction,
          chainId: runtimeConfig.chainId,
          govCoreAddress: runtimeConfig.contracts.govCoreAddress,
          resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
          resolvedRoleId,
        });
      },
      runSerialFallback: () => openAssignMandateGroupSerial(),
      title: "Batch activate mandates",
    });
  }, [
    assignMandateActions,
    createRoleActions,
    openAssignMandateGroupSerial,
    openSetupGroupBatchTransactionModal,
    resolvedOrgId,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
  ]);

  const openSetPolicyRuleGroupSerial = useCallback(async (): Promise<void> => {
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

  const executeSetPolicyRuleGroup = useCallback(async (): Promise<void> => {
    const policyDependencyError = setPolicyRuleActions
      .map((action) =>
        assertPolicyDependenciesResolved({
          action,
          mandateActions: assignMandateActions,
          resolvedMandateIds: stateRef.current.resolvedMandateIds,
          roleActions: createRoleActions,
        }),
      )
      .find((error): error is Error => error instanceof Error);
    const batchInput = policyDependencyError
      ? policyDependencyError
      : buildBatchSetPolicyRulesInput({
          actions: setPolicyRuleActions,
          bodyActions: createBodyActions,
          resolvedBodyIds: stateRef.current.resolvedBodyIds,
          resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
        });
    if (!(batchInput instanceof Error)) {
      const plan = createAdminBatchActivationPlan({
        policyRules: batchInput,
        capabilities: activationCapabilities,
      });
      const call = plan.calls.find(
        (candidate): candidate is SetPolicyRulesActivationPlanCall =>
          candidate.group === "policyRules",
      );
      if (isContractBatchActivationMode(plan.executionMode) && call) {
        openSetupGroupContractBatchTransactionModal({
          actions: setPolicyRuleActions,
          call,
          description:
            "Submit one typed GovCore batch for ready policy route setup calls, then wait for indexed read models.",
          getItemId: (actionId) =>
            buildSetupTransactionModalItemId("set-policy-rule", actionId),
          runSerialFallback: () => openSetPolicyRuleGroupSerial(),
          title: "Batch activate policy routes",
        });
        return;
      }
    }

    await openSetPolicyRuleGroupSerial();
  }, [
    activationCapabilities,
    assignMandateActions,
    createBodyActions,
    createRoleActions,
    openSetPolicyRuleGroupSerial,
    openSetupGroupContractBatchTransactionModal,
    resolvedOrgId,
    setPolicyRuleActions,
  ]);

  const executeSetPolicyRuleGroupBatch = useCallback(async (): Promise<void> => {
    openSetupGroupBatchTransactionModal({
      actions: setPolicyRuleActions,
      description:
        "Submit ready policy route calls as an EIP-5792 wallet batch, then wait for indexed read models.",
      getItemId: (actionId) =>
        buildSetupTransactionModalItemId("set-policy-rule", actionId),
      prepareCall: (action) => {
        const policyAction = action as SetPolicyRuleSetupAction;
        const dependencyError = assertPolicyDependenciesResolved({
          action: policyAction,
          mandateActions: assignMandateActions,
          resolvedMandateIds: stateRef.current.resolvedMandateIds,
          roleActions: createRoleActions,
        });
        if (dependencyError) {
          return dependencyError;
        }
        return prepareSetPolicyRuleCall({
          action: policyAction,
          bodyActions: createBodyActions,
          chainId: runtimeConfig.chainId,
          govCoreAddress: runtimeConfig.contracts.govCoreAddress,
          resolvedBodyIds: stateRef.current.resolvedBodyIds,
          resolvedOrgId: stateRef.current.resolvedOrgId ?? resolvedOrgId ?? "",
        });
      },
      runSerialFallback: () => openSetPolicyRuleGroupSerial(),
      title: "Batch activate policy routes",
    });
  }, [
    assignMandateActions,
    createBodyActions,
    createRoleActions,
    openSetPolicyRuleGroupSerial,
    openSetupGroupBatchTransactionModal,
    resolvedOrgId,
    runtimeConfig.chainId,
    runtimeConfig.contracts.govCoreAddress,
    setPolicyRuleActions,
  ]);

  return {
    busy,
    eip5792BatchCapability,
    eip5792BatchChecking,
    eip5792BatchFeatureEnabled,
    executeAssignMandate,
    executeAssignMandateGroupBatch,
    executeAssignMandateGroup,
    executeCreateBody,
    executeCreateBodyGroupBatch,
    executeCreateBodyGroup,
    executeCreateOrganization,
    executeCreateRole,
    executeCreateRoleGroupBatch,
    executeCreateRoleGroup,
    executeSetPolicyRule,
    executeSetPolicyRuleGroupBatch,
    executeSetPolicyRuleGroup,
    refreshEip5792BatchCapability,
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

interface SetupGroupBatchRunConfig {
  readonly actions: readonly SetupAction[];
  readonly calls: readonly PreparedContractCall[];
  readonly getItemId: (actionId: string) => string;
}

interface SetupGroupBatchModalConfig {
  readonly actions: readonly SetupAction[];
  readonly description: string;
  readonly getItemId: (actionId: string) => string;
  readonly prepareCall: (action: SetupAction) => PreparedActivationCall | Error;
  readonly runSerialFallback: () => Promise<void> | void;
  readonly title: string;
}

interface SetupGroupContractBatchRunConfig {
  readonly actions: readonly SetupAction[];
  readonly call: AdminBatchActivationPlanCall;
  readonly getItemId: (actionId: string) => string;
}

interface SetupGroupContractBatchModalConfig
  extends SetupGroupContractBatchRunConfig {
  readonly description: string;
  readonly runSerialFallback: () => Promise<void> | void;
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

function applyBatchActionTransactionPatch({
  actions,
  error,
  setState,
  stage,
  txHashes = [],
}: {
  readonly actions: readonly SetupAction[];
  readonly error?: string;
  readonly setState: SetupExecutionStateUpdater;
  readonly stage: SetupActionLifecycleStage;
  readonly txHashes?: readonly `0x${string}`[];
}): void {
  setState((current) => {
    let createOrganization = current.createOrganization;
    const assignMandates = { ...current.assignMandates };
    const createBodies = { ...current.createBodies };
    const createRoles = { ...current.createRoles };
    const setPolicyRules = { ...current.setPolicyRules };

    actions.forEach((action, index) => {
      const transaction: SetupActionTransaction = {
        actionId: action.actionId,
        actionKind: action.kind,
        error,
        stage,
        txHash: getBatchActionTxHash(txHashes, index),
      };

      switch (action.kind) {
        case SetupActionKind.CreateOrganization:
          createOrganization = transaction;
          break;
        case SetupActionKind.CreateBody:
          createBodies[action.actionId] = transaction;
          break;
        case SetupActionKind.CreateRole:
          createRoles[action.actionId] = transaction;
          break;
        case SetupActionKind.AssignMandate:
          assignMandates[action.actionId] = transaction;
          break;
        case SetupActionKind.SetPolicyRule:
          setPolicyRules[action.actionId] = transaction;
          break;
      }
    });

    return {
      ...current,
      assignMandates,
      createBodies,
      createOrganization,
      createRoles,
      setPolicyRules,
    };
  });
}

function updateBatchModalItems({
  actions,
  getItemId,
  patch,
  updateTransactionModalItem,
}: {
  readonly actions: readonly SetupAction[];
  readonly getItemId: (actionId: string) => string;
  readonly patch: TransactionFlowItemPatch;
  readonly updateTransactionModalItem: (
    itemId: string,
    update: TransactionFlowItemPatch,
  ) => void;
}): void {
  actions.forEach((action) => {
    updateTransactionModalItem(getItemId(action.actionId), patch);
  });
}

function updateBatchModalItemHashes({
  actions,
  getItemId,
  txHashes,
  updateTransactionModalItem,
}: {
  readonly actions: readonly SetupAction[];
  readonly getItemId: (actionId: string) => string;
  readonly txHashes: readonly `0x${string}`[];
  readonly updateTransactionModalItem: (
    itemId: string,
    update: TransactionFlowItemPatch,
  ) => void;
}): void {
  actions.forEach((action, index) => {
    const txHash = getBatchActionTxHash(txHashes, index);
    if (txHash) {
      updateTransactionModalItem(getItemId(action.actionId), { txHash });
    }
  });
}

async function waitForBatchReadModelCompletion({
  actions,
  client,
  draft,
  getExecutionState,
  getItemId,
  orgId,
  readModels,
  setExecutionState,
  updateTransactionModalItem,
}: {
  readonly actions: readonly SetupAction[];
  readonly client: IsoniaControlPlaneClient;
  readonly draft: SetupDraft;
  readonly getExecutionState: () => SetupDraftExecutionState;
  readonly getItemId: (actionId: string) => string;
  readonly orgId: string | undefined;
  readonly readModels?: SetupCompletionReadModels;
  readonly setExecutionState: SetupExecutionStateUpdater;
  readonly updateTransactionModalItem: (
    itemId: string,
    update: TransactionFlowItemPatch,
  ) => void;
}): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const complete = await refreshBatchReadModelProgress({
        actions,
        client,
        draft,
        getExecutionState,
        getItemId,
        orgId,
        readModels,
        setExecutionState,
        updateTransactionModalItem,
      });
      if (complete) {
        return;
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await delay(1_500);
  }

  throw new Error(
    `Indexer timeout: activation batch did not reach indexed read models within 60 seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

async function refreshBatchReadModelProgress({
  actions,
  client,
  draft,
  getExecutionState,
  getItemId,
  orgId,
  readModels,
  setExecutionState,
  updateTransactionModalItem,
}: {
  readonly actions: readonly SetupAction[];
  readonly client: IsoniaControlPlaneClient;
  readonly draft: SetupDraft;
  readonly getExecutionState: () => SetupDraftExecutionState;
  readonly getItemId: (actionId: string) => string;
  readonly orgId: string | undefined;
  readonly readModels?: SetupCompletionReadModels;
  readonly setExecutionState: SetupExecutionStateUpdater;
  readonly updateTransactionModalItem: (
    itemId: string,
    update: TransactionFlowItemPatch,
  ) => void;
}): Promise<boolean> {
  if (!orgId) {
    throw new Error("Cannot poll activation read models before orgId is known.");
  }

  const freshReadModels =
    (await loadSetupCompletionReadModels(client, orgId)) ?? readModels;
  const nextState = deriveSetupExecutionStateFromReadModels({
    draft,
    executionState: getExecutionState(),
    readModels: freshReadModels,
  });
  setExecutionState(() => nextState);

  for (const action of actions) {
    const itemId = getItemId(action.actionId);
    const patch = buildSetupTransactionModalItemPatch({
      draft,
      executionState: nextState,
      itemId,
      readModels: freshReadModels,
      serial: true,
    });
    if (patch) {
      updateTransactionModalItem(itemId, patch);
    }
  }

  return actions.every((action) => {
    const result = getCompletionResult(
      action.actionId,
      draft,
      nextState,
      freshReadModels,
    );
    return result?.state === "indexed";
  });
}

async function loadSetupCompletionReadModels(
  client: IsoniaControlPlaneClient,
  orgId: string,
): Promise<SetupCompletionReadModels> {
  const [organization, bodies, roles, mandates, policies] = await Promise.all([
    client.getOrganization(orgId),
    client.getBodies(orgId),
    client.getRoles(orgId),
    client.getMandates(orgId),
    client.policies.list(orgId),
  ]);

  return {
    bodies,
    mandates,
    organization,
    policies,
    roles,
  };
}

function getBatchActionTxHash(
  txHashes: readonly `0x${string}`[],
  index: number,
): `0x${string}` | undefined {
  if (txHashes.length === 1) {
    return txHashes[0];
  }
  return txHashes[index];
}
