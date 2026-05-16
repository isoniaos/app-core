import type { SetupAction } from "@isonia/types";
import type {
  SetupCompletionActionState,
  SetupCompletionActionVerification,
  SetupCompletionReadModels,
} from "../setup-completion-verification";

export type ActivationGroupId = "bodies" | "roles" | "mandates" | "policies";
export type ActivationGroupCompletionState =
  | "blocked"
  | "complete"
  | "failed"
  | "needs_confirmation"
  | "pending"
  | "ready";

export interface ActivationGroupProgress {
  readonly activeAction?: SetupAction;
  readonly blockedActions: number;
  readonly canContinue: boolean;
  readonly canRun: boolean;
  readonly complete: boolean;
  readonly disabledReason?: string;
  readonly executableActions: number;
  readonly failedActions: number;
  readonly groupId: ActivationGroupId;
  readonly indexedActions: number;
  readonly needsInput: boolean;
  readonly nextAction?: SetupAction;
  readonly pendingActions: number;
  readonly reason: string;
  readonly state: ActivationGroupCompletionState;
  readonly totalActions: number;
}

export function buildActivationGroupProgress({
  actions,
  groupId,
  resultByActionId,
}: {
  readonly actions: readonly SetupAction[];
  readonly groupId: ActivationGroupId;
  readonly readModels?: SetupCompletionReadModels;
  readonly resultByActionId: ReadonlyMap<
    string,
    SetupCompletionActionVerification
  >;
}): ActivationGroupProgress {
  const totalActions = actions.length;
  const results = actions.map((action) => resultByActionId.get(action.actionId));
  const indexedActions = countResultsByState(results, "indexed");
  const failedActions = countResultsByState(results, "failed");
  const blockedActions = results.filter((result) =>
    result ? isBlockedState(result.state) : false,
  ).length;
  const executableActions = results.filter((result) =>
    result ? isExecutableState(result.state) : true,
  ).length;
  const pendingActions = Math.max(
    0,
    totalActions - indexedActions - failedActions - blockedActions,
  );
  const activeAction = actions.find(
    (action) => resultByActionId.get(action.actionId)?.state !== "indexed",
  );
  const needsInput = needsGroupInput({ actions, groupId });
  const complete =
    !needsInput &&
    (totalActions === 0 ||
      (totalActions > 0 && indexedActions === totalActions));
  const state = getActivationGroupCompletionState({
    blockedActions,
    complete,
    executableActions,
    failedActions,
    needsInput,
  });
  const canRun =
    state !== "complete" &&
    state !== "needs_confirmation" &&
    state !== "blocked" &&
    executableActions > 0;
  const canContinue = complete;
  const reason = getGroupProgressReason({
    blockedActions,
    canRun,
    complete,
    executableActions,
    failedActions,
    groupId,
    indexedActions,
    needsInput,
    pendingActions,
    totalActions,
  });

  return {
    activeAction,
    blockedActions,
    canContinue,
    canRun,
    complete,
    disabledReason: canRun ? undefined : reason,
    executableActions,
    failedActions,
    groupId,
    indexedActions,
    needsInput,
    nextAction: activeAction,
    pendingActions,
    reason,
    state,
    totalActions,
  };
}

export function canExecuteActivationActionState(
  state: SetupCompletionActionState | undefined,
): boolean {
  if (!state) {
    return true;
  }

  return isExecutableState(state);
}

function countResultsByState(
  results: readonly (SetupCompletionActionVerification | undefined)[],
  state: SetupCompletionActionState,
): number {
  return results.filter((result) => result?.state === state).length;
}

function needsGroupInput({
  actions,
  groupId,
}: {
  readonly actions: readonly SetupAction[];
  readonly groupId: ActivationGroupId;
}): boolean {
  if (groupId !== "mandates" || actions.length > 0) {
    return false;
  }

  return true;
}

function getGroupProgressReason({
  blockedActions,
  canRun,
  complete,
  executableActions,
  failedActions,
  groupId,
  indexedActions,
  needsInput,
  pendingActions,
  totalActions,
}: {
  readonly blockedActions: number;
  readonly canRun: boolean;
  readonly complete: boolean;
  readonly executableActions: number;
  readonly failedActions: number;
  readonly groupId: ActivationGroupId;
  readonly indexedActions: number;
  readonly needsInput: boolean;
  readonly pendingActions: number;
  readonly totalActions: number;
}): string {
  if (needsInput) {
    return "Mandate holder inputs are required.";
  }

  if (complete) {
    return totalActions === 0
      ? "No actions are needed for this group."
      : `${indexedActions} of ${totalActions} actions are indexed.`;
  }

  if (failedActions > 0) {
    return `${failedActions} failed action${
      failedActions === 1 ? "" : "s"
    } can be retried.`;
  }

  if (blockedActions > 0) {
    return `${blockedActions} action${
      blockedActions === 1 ? " is" : "s are"
    } waiting for dependencies or validation.`;
  }

  if (canRun) {
    return `Ready to run ${getGroupLabel(groupId)} activation.`;
  }

  if (executableActions === 0) {
    return `No ${getGroupLabel(groupId)} action is ready to run.`;
  }

  return pendingActions > 0
    ? "Continue this step after indexed progress refreshes."
    : "This group has no pending setup action.";
}

function getActivationGroupCompletionState({
  blockedActions,
  complete,
  executableActions,
  failedActions,
  needsInput,
}: {
  readonly blockedActions: number;
  readonly complete: boolean;
  readonly executableActions: number;
  readonly failedActions: number;
  readonly needsInput: boolean;
}): ActivationGroupCompletionState {
  if (complete) {
    return "complete";
  }

  if (needsInput) {
    return "needs_confirmation";
  }

  if (blockedActions > 0) {
    return "blocked";
  }

  if (failedActions > 0) {
    return "failed";
  }

  return executableActions > 0 ? "ready" : "pending";
}

function isExecutableState(state: SetupCompletionActionState): boolean {
  return (
    state === "not_started" ||
    state === "failed" ||
    state === "missing_indexed_entity" ||
    state === "unresolved_policy_rule"
  );
}

function isBlockedState(state: SetupCompletionActionState): boolean {
  return (
    state === "blocked" ||
    state === "in_progress" ||
    state === "unresolved_dependency"
  );
}

function getGroupLabel(groupId: ActivationGroupId): string {
  switch (groupId) {
    case "bodies":
      return "body";
    case "roles":
      return "role";
    case "mandates":
      return "mandate";
    case "policies":
      return "policy";
  }
}
