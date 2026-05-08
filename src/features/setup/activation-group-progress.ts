import type { SetupAction } from "@isonia/types";
import type {
  SetupCompletionActionState,
  SetupCompletionActionVerification,
  SetupCompletionReadModels,
} from "./setup-completion-verification";

export type ActivationGroupId = "bodies" | "roles" | "mandates" | "policies";

export interface ActivationGroupProgress {
  readonly blockedActions: number;
  readonly canContinue: boolean;
  readonly canRun: boolean;
  readonly complete: boolean;
  readonly executableActions: number;
  readonly failedActions: number;
  readonly groupId: ActivationGroupId;
  readonly indexedActions: number;
  readonly needsInput: boolean;
  readonly nextAction?: SetupAction;
  readonly reason: string;
  readonly totalActions: number;
}

export function buildActivationGroupProgress({
  actions,
  groupId,
  readModels,
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
  const nextAction = actions.find(
    (action) => resultByActionId.get(action.actionId)?.state !== "indexed",
  );
  const needsInput = needsGroupInput({ actions, groupId });
  const complete =
    !needsInput &&
    (totalActions === 0 ||
      (totalActions > 0 && indexedActions === totalActions));
  const canRun =
    !complete &&
    !needsInput &&
    executableActions > 0 &&
    blockedActions === 0;
  const canContinue = complete;

  return {
    blockedActions,
    canContinue,
    canRun,
    complete,
    executableActions,
    failedActions,
    groupId,
    indexedActions,
    needsInput,
    nextAction,
    reason: getGroupProgressReason({
      blockedActions,
      canRun,
      complete,
      executableActions,
      failedActions,
      groupId,
      indexedActions,
      needsInput,
      nextAction,
      readModels,
      totalActions,
    }),
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
  nextAction,
  readModels,
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
  readonly nextAction?: SetupAction;
  readonly readModels?: SetupCompletionReadModels;
  readonly totalActions: number;
}): string {
  if (needsInput) {
    const indexedMandates = readModels?.mandates.length ?? 0;
    return indexedMandates > 0
      ? "Activation progress exists, but exact mandate intent requires holder inputs to confirm."
      : "Add mandate holder addresses before mandate activation can continue.";
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

  if (canRun && nextAction) {
    return `Next required action: ${nextAction.label}.`;
  }

  if (executableActions === 0) {
    return `No ${getGroupLabel(groupId)} action is ready to run.`;
  }

  return "Continue this step after indexed progress refreshes.";
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
