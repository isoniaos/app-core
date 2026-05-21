import type {
  ExecutionSelectorRuleDto,
  ExecutionTargetPermissionDto,
  OrganizationExecutionPermissionsDto,
  ProposalDto,
} from "@isonia/types";

export type ExecutionPermissionNoticeTone =
  | "danger"
  | "muted"
  | "success"
  | "warning";

export interface PermissionActionIdentity {
  readonly actionSelector?: string;
  readonly source: string;
  readonly targetAddress?: string;
  readonly value: string;
}

export interface ExecutionPermissionNoticeDisplay {
  readonly inlineTone: ExecutionPermissionNoticeTone;
  readonly label: string;
  readonly message: string;
  readonly selector?: ExecutionSelectorRuleDto;
  readonly target?: ExecutionTargetPermissionDto;
  readonly title: string;
  readonly tone: ExecutionPermissionNoticeTone;
}

export function getPermissionActionIdentity(
  proposal: ProposalDto,
): PermissionActionIdentity {
  const receipt = proposal.executionReceipt;

  if (receipt) {
    return {
      actionSelector: proposal.actionSelector ?? receipt.actionSelector,
      source:
        "Proposal final target, value, and selector; receipt final target used only as fallback. Managed executor ignored.",
      targetAddress: proposal.targetAddress ?? receipt.targetAddress,
      value: proposal.value,
    };
  }

  return {
    actionSelector: proposal.actionSelector,
    source:
      "Proposal target, value, and protocol-declared selector; managed executor ignored.",
    targetAddress: proposal.targetAddress,
    value: proposal.value,
  };
}

export function getExecutionPermissionNotice({
  identity,
  permissions,
  permissionsError,
}: {
  readonly identity: PermissionActionIdentity;
  readonly permissions?: OrganizationExecutionPermissionsDto;
  readonly permissionsError?: Error;
}): ExecutionPermissionNoticeDisplay {
  if (!permissions) {
    return {
      inlineTone: "warning",
      label: "Registry unavailable",
      message: isNotFoundLikeApiError(permissionsError)
        ? "This Control Plane does not expose the execution permission registry endpoint yet. App Core cannot compare this proposal action identity against registry read models."
        : permissionsError?.message ??
          "Execution permission registry read-model data is unavailable for this proposal action identity.",
      title: "Execution permission data unavailable",
      tone: "warning",
    };
  }

  const target = permissions.targets.find(
    (entry) =>
      identity.targetAddress !== undefined &&
      sameAddress(entry.targetAddress, identity.targetAddress),
  );

  if (!target) {
    return {
      inlineTone: "warning",
      label: "Target not configured",
      message:
        "No target rule was returned for this proposal target address. Execution may be blocked by the protocol registry, or the read model may be incomplete.",
      title: "No registry target rule",
      tone: "warning",
    };
  }

  if (!target.enabled) {
    return {
      inlineTone: "danger",
      label: "Target disabled",
      message:
        "The current execution permission registry read model marks this target as disabled. The contract remains authoritative when execution is submitted.",
      target,
      title: "Registry target is disabled",
      tone: "danger",
    };
  }

  const valueComparison = compareNumericStrings(identity.value, target.maxValue);
  if (valueComparison === undefined) {
    return {
      inlineTone: "warning",
      label: "Check value",
      message:
        "The target rule is enabled, but App Core could not compare the proposal value against the registry value limit.",
      target,
      title: "Value comparison unavailable",
      tone: "warning",
    };
  }

  if (valueComparison > 0) {
    return {
      inlineTone: "danger",
      label: "Value above limit",
      message:
        "The proposal value is above the target value limit in the execution permission registry read model. Execution may be blocked by protocol checks.",
      target,
      title: "Registry value limit exceeded",
      tone: "danger",
    };
  }

  const actionSelector = identity.actionSelector;

  if (!actionSelector) {
    return {
      inlineTone: "warning",
      label: "Selector unavailable",
      message:
        "This legacy proposal read model does not expose the protocol-declared bytes4 action selector. App Core will not infer it from dataHash, parse calldata, or map it to an ABI method name.",
      target,
      title: "Protocol action selector unavailable",
      tone: "warning",
    };
  }

  const selector = target.selectors.find((entry) =>
    sameSelector(entry.selector, actionSelector),
  );

  if (!selector) {
    return {
      inlineTone: "warning",
      label: "Selector not configured",
      message:
        "No selector rule was returned for the protocol-declared action selector under this target. The read model does not show permission for this action selector.",
      target,
      title: "No registry selector rule",
      tone: "warning",
    };
  }

  if (!selector.enabled) {
    return {
      inlineTone: "danger",
      label: "Selector disabled",
      message:
        "The current execution permission registry read model marks the selector matching this proposal action as disabled. Execution may be blocked by protocol checks.",
      selector,
      target,
      title: "Registry selector is disabled",
      tone: "danger",
    };
  }

  return {
    inlineTone: "success",
    label: "Target and selector enabled",
    message:
      "Target, value, and protocol-declared action selector match enabled registry read model entries. This does not prove execution will succeed; contracts remain authoritative.",
    selector,
    target,
    title: "Registry target and selector are enabled",
    tone: "success",
  };
}

export function compareNumericStrings(
  left: string,
  right: string,
): number | undefined {
  try {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    if (leftValue === rightValue) {
      return 0;
    }
    return leftValue > rightValue ? 1 : -1;
  } catch {
    return undefined;
  }
}

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function sameSelector(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isNotFoundLikeApiError(error: Error | undefined): boolean {
  if (!error) {
    return false;
  }

  const status = (error as Error & { readonly status?: unknown }).status;
  return status === 404;
}
