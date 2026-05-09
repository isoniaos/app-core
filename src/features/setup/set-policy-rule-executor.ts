import type {
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import {
  GOV_CORE_ABI,
  parsePolicyRuleSetLog,
} from "../../chain/setup-contracts";
import { waitForIndexedPolicyRule } from "./indexing-waiters";
import {
  assertPolicyRuleMatchesPayload,
  assertSuccessfulReceipt,
} from "./receipt-parsers";
import {
  isConfiguredAddress,
  normalizeTransactionError,
} from "./setup-action-execution-helpers";
import { getSetupActionExecutionPreflight } from "./setup-action-preflight";
import type {
  SetupActionExecutorContext,
  SetupActionTransaction,
} from "./setup-action-execution-types";
import {
  assertPolicyDependenciesResolved,
  buildSetPolicyRuleCallArgs,
  buildSetPolicyRulePayload,
} from "./setup-prepared-calls";

export async function executeSetPolicyRuleAction({
  actionId,
  actions,
  bodyActions,
  busy,
  context,
  mandateActions,
  resolvedBodyIds,
  resolvedMandateIds,
  resolvedOrgId,
  resolvedPolicyVersions,
  roleActions,
}: {
  readonly actionId: string;
  readonly actions: readonly SetPolicyRuleSetupAction[];
  readonly bodyActions: readonly CreateBodySetupAction[];
  readonly busy: boolean;
  readonly context: SetupActionExecutorContext;
  readonly mandateActions: readonly AssignMandateSetupAction[];
  readonly resolvedBodyIds: Readonly<Record<string, string>>;
  readonly resolvedMandateIds: Readonly<Record<string, string>>;
  readonly resolvedOrgId: string | undefined;
  readonly resolvedPolicyVersions: Readonly<Record<string, string>>;
  readonly roleActions: readonly CreateRoleSetupAction[];
}): Promise<void> {
  const {
    account,
    client,
    publicClient,
    runtimeConfig,
    setState,
    setupWritesEnabled,
    writeContractAsync,
  } = context;
  const action = actions.find((candidate) => candidate.actionId === actionId);
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

  if (resolvedPolicyVersions[action.actionId]) {
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

  const dependencyError = assertPolicyDependenciesResolved({
    action,
    mandateActions,
    resolvedMandateIds,
    roleActions,
  });
  if (dependencyError) {
    setPolicyActionFailed(action, dependencyError.message);
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

  const signerPreflight = getSetupActionExecutionPreflight(action, {
    accountChainId: account.chainId,
    connected: account.isConnected,
    connectedAddress: account.address,
    govCoreAddress: runtimeConfig.contracts.govCoreAddress,
    runtimeChainId: runtimeConfig.chainId,
    setupWritesEnabled,
  });
  if (!signerPreflight.canExecute) {
    setPolicyActionFailed(action, signerPreflight.message);
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
    bodyActions,
    resolvedBodyIds,
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
      args: buildSetPolicyRuleCallArgs(payload),
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
}
