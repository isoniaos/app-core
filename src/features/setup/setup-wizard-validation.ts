import { parseAddressListInput, validateAddressInput } from "../../ui/address";
import { validateOrganizationSlug } from "../../chain/setup-contracts";
import type { SimpleDaoPlusDraftInputs } from "./setup-templates";

export type SetupWizardStepId =
  | "template"
  | "bodies"
  | "identity"
  | "holders"
  | "routes"
  | "review";

export type SetupWizardFieldId =
  | "organizationName"
  | "organizationSlug"
  | "organizationAdminAddress"
  | "generalCouncilHolderAddresses"
  | "treasuryCommitteeHolderAddresses"
  | "securityCouncilHolderAddresses"
  | "executorHolderAddress"
  | "standardTimelockSeconds"
  | "treasuryTimelockSeconds"
  | "upgradeTimelockSeconds"
  | "emergencyTimelockSeconds";

export type SetupWizardFieldIssueSeverity = "error" | "warning" | "info";

export interface SetupWizardFieldIssue {
  readonly fieldId: SetupWizardFieldId;
  readonly message: string;
  readonly severity: SetupWizardFieldIssueSeverity;
}

export type SetupWizardFieldIssueMap = Partial<
  Record<SetupWizardFieldId, SetupWizardFieldIssue>
>;

export type SetupWizardTouchedFields = Partial<Record<SetupWizardFieldId, boolean>>;

const MAX_UINT64 = 18_446_744_073_709_551_615n;

const STEP_FIELDS: Record<SetupWizardStepId, readonly SetupWizardFieldId[]> = {
  bodies: [],
  holders: [
    "generalCouncilHolderAddresses",
    "treasuryCommitteeHolderAddresses",
    "securityCouncilHolderAddresses",
    "executorHolderAddress",
  ],
  identity: [
    "organizationName",
    "organizationSlug",
    "organizationAdminAddress",
  ],
  review: [],
  routes: [
    "standardTimelockSeconds",
    "treasuryTimelockSeconds",
    "upgradeTimelockSeconds",
    "emergencyTimelockSeconds",
  ],
  template: [],
};

const TIMELOCK_BASELINES: Partial<Record<SetupWizardFieldId, bigint>> = {
  emergencyTimelockSeconds: 0n,
  standardTimelockSeconds: 300n,
  treasuryTimelockSeconds: 3_600n,
  upgradeTimelockSeconds: 3_600n,
};

const TIMELOCK_LABELS: Partial<Record<SetupWizardFieldId, string>> = {
  emergencyTimelockSeconds: "Emergency delay",
  standardTimelockSeconds: "Standard delay",
  treasuryTimelockSeconds: "Treasury delay",
  upgradeTimelockSeconds: "Upgrade delay",
};

export function getStepFieldIds(
  stepId: SetupWizardStepId,
): readonly SetupWizardFieldId[] {
  return STEP_FIELDS[stepId];
}

export function validateSetupWizardStep(
  stepId: SetupWizardStepId,
  inputs: SimpleDaoPlusDraftInputs,
): readonly SetupWizardFieldIssue[] {
  switch (stepId) {
    case "identity":
      return validateIdentityStep(inputs);
    case "holders":
      return validateHoldersStep(inputs);
    case "routes":
      return validateRoutesStep(inputs);
    case "template":
    case "bodies":
    case "review":
      return [];
  }
}

export function toFieldIssueMap(
  issues: readonly SetupWizardFieldIssue[],
): SetupWizardFieldIssueMap {
  const map: Record<string, SetupWizardFieldIssue> = {};

  for (const issue of issues) {
    const current = map[issue.fieldId];
    if (!current || getSeverityRank(issue.severity) > getSeverityRank(current.severity)) {
      map[issue.fieldId] = issue;
    }
  }

  return map;
}

function validateIdentityStep(
  inputs: SimpleDaoPlusDraftInputs,
): readonly SetupWizardFieldIssue[] {
  const issues: SetupWizardFieldIssue[] = [];

  if (inputs.organizationName.trim().length === 0) {
    issues.push({
      fieldId: "organizationName",
      message: "Organization name is required.",
      severity: "error",
    });
  }

  const slugError = validateOrganizationSlug(inputs.organizationSlug);
  if (slugError) {
    issues.push({
      fieldId: "organizationSlug",
      message: slugError,
      severity: "error",
    });
  }

  const adminValidation = validateAddressInput(inputs.organizationAdminAddress, {
    required: true,
  });
  if (!adminValidation.isValid) {
    issues.push({
      fieldId: "organizationAdminAddress",
      message: adminValidation.message,
      severity: "error",
    });
  }

  return issues;
}

function validateHoldersStep(
  inputs: SimpleDaoPlusDraftInputs,
): readonly SetupWizardFieldIssue[] {
  return [
    ...validateAddressListField({
      fieldId: "generalCouncilHolderAddresses",
      label: "General Council holders",
      values: inputs.generalCouncilHolderAddresses,
    }),
    ...validateAddressListField({
      fieldId: "treasuryCommitteeHolderAddresses",
      label: "Treasury Committee holders",
      values: inputs.treasuryCommitteeHolderAddresses,
    }),
    ...validateAddressListField({
      fieldId: "securityCouncilHolderAddresses",
      label: "Security Council holders",
      values: inputs.securityCouncilHolderAddresses,
    }),
    ...validateSingleAddressField({
      fieldId: "executorHolderAddress",
      label: "Executor holder address",
      value: inputs.executorHolderAddress,
    }),
  ];
}

function validateRoutesStep(
  inputs: SimpleDaoPlusDraftInputs,
): readonly SetupWizardFieldIssue[] {
  return [
    ...validateTimelockField("standardTimelockSeconds", inputs.standardTimelockSeconds),
    ...validateTimelockField("treasuryTimelockSeconds", inputs.treasuryTimelockSeconds),
    ...validateTimelockField("upgradeTimelockSeconds", inputs.upgradeTimelockSeconds),
    ...validateTimelockField("emergencyTimelockSeconds", inputs.emergencyTimelockSeconds),
  ];
}

function validateAddressListField({
  fieldId,
  label,
  values,
}: {
  readonly fieldId: SetupWizardFieldId;
  readonly label: string;
  readonly values: readonly string[];
}): readonly SetupWizardFieldIssue[] {
  const parsed = parseAddressListInput(values);
  const validCount = parsed.filter((item) => item.validation.isValid).length;
  const invalidCount = parsed.filter((item) => !item.validation.isValid).length;

  if (validCount === 0) {
    return [
      {
        fieldId,
        message: `${label} require at least one valid EVM address.`,
        severity: "error",
      },
    ];
  }

  if (invalidCount > 0) {
    return [
      {
        fieldId,
        message: `${label} include ${invalidCount} invalid address ${invalidCount === 1 ? "entry" : "entries"}.`,
        severity: "error",
      },
    ];
  }

  return [];
}

function validateSingleAddressField({
  fieldId,
  label,
  value,
}: {
  readonly fieldId: SetupWizardFieldId;
  readonly label: string;
  readonly value: string;
}): readonly SetupWizardFieldIssue[] {
  const validation = validateAddressInput(value, { required: true });
  if (validation.isValid) {
    return [];
  }

  return [
    {
      fieldId,
      message:
        validation.status === "empty" ? `${label} is required.` : validation.message,
      severity: "error",
    },
  ];
}

function validateTimelockField(
  fieldId: SetupWizardFieldId,
  value: string,
): readonly SetupWizardFieldIssue[] {
  const label = TIMELOCK_LABELS[fieldId] ?? "Timelock";
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return [
      {
        fieldId,
        message: `${label} must be a non-negative integer in seconds.`,
        severity: "error",
      },
    ];
  }

  let parsed: bigint;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return [
      {
        fieldId,
        message: `${label} must be a non-negative integer in seconds.`,
        severity: "error",
      },
    ];
  }

  if (parsed > MAX_UINT64) {
    return [
      {
        fieldId,
        message: `${label} must fit in uint64 seconds.`,
        severity: "error",
      },
    ];
  }

  const baseline = TIMELOCK_BASELINES[fieldId];
  if (baseline !== undefined && parsed < baseline && fieldId !== "emergencyTimelockSeconds") {
    return [
      {
        fieldId,
        message: `${label} is shorter than the alpha review baseline of ${baseline.toString()} seconds.`,
        severity: "warning",
      },
    ];
  }

  return [];
}

function getSeverityRank(severity: SetupWizardFieldIssueSeverity): number {
  switch (severity) {
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
      return 1;
  }
}
