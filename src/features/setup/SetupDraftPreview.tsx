import type {
  AssignMandateSetupAction,
  CreateBodySetupAction,
  CreateOrganizationSetupAction,
  CreateRoleSetupAction,
  SetPolicyRuleSetupAction,
  SetupAction,
  SetupDraft,
  SetupEntityReference,
  SetupValidationWarning,
  SetupValidationWarningSeverity,
  TemplateDescriptor,
} from "@isonia/types";
import { SetupActionKind, SetupDraftStatus } from "@isonia/types";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatLabel,
  formatNumericString,
} from "../../utils/format";
import type { SetupValidationSummary } from "./setup-validation";
import { summarizeSetupValidationWarnings } from "./setup-validation";

interface SetupActionGroup {
  readonly key: string;
  readonly label: string;
  readonly kinds: readonly SetupActionKind[];
}

const SETUP_ACTION_GROUPS: readonly SetupActionGroup[] = [
  {
    key: "organization",
    kinds: [SetupActionKind.CreateOrganization],
    label: "Organization",
  },
  {
    key: "bodies",
    kinds: [SetupActionKind.CreateBody],
    label: "Bodies",
  },
  {
    key: "roles",
    kinds: [SetupActionKind.CreateRole],
    label: "Roles",
  },
  {
    key: "mandates",
    kinds: [SetupActionKind.AssignMandate],
    label: "Mandates",
  },
  {
    key: "policy-rules",
    kinds: [SetupActionKind.SetPolicyRule],
    label: "Policy Rules",
  },
];

interface TemplateSelectionProps {
  readonly selectedTemplateId: string;
  readonly templates: readonly TemplateDescriptor[];
}

export function TemplateSelection({
  selectedTemplateId,
  templates,
}: TemplateSelectionProps): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Templates</h2>
          <p className="panel-subtitle">
            Templates prepare editable setup drafts. Authority is created only
            by later contract transactions.
          </p>
        </div>
      </div>
      <div className="template-grid">
        {templates.map((template, index) => {
          const selected = template.templateId === selectedTemplateId;
          const available = index === 0;
          return (
            <article
              className={`template-card${
                selected ? " template-card-selected" : ""
              }`}
              key={template.templateId}
            >
              <div className="entity-card-header">
                <div>
                  <h3>{template.name}</h3>
                  <p>{template.summary}</p>
                </div>
                <StatusBadge tone={available ? "success" : "muted"}>
                  {available ? "Selected" : "Later"}
                </StatusBadge>
              </div>
              {template.description ? <p>{template.description}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function SetupDraftPreview({
  draft,
}: {
  readonly draft: SetupDraft;
}): JSX.Element {
  const draftSummary = summarizeDraft(draft);
  const validationSummary = summarizeSetupValidationWarnings(draft.warnings);
  const readiness = getDraftReadiness(draft, validationSummary);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Setup Draft</h2>
          <p className="panel-subtitle">
            Browser-side draft state for the selected template. It is not
            submitted, indexed, or authoritative.
          </p>
        </div>
        <StatusBadge tone={readiness.tone}>{readiness.label}</StatusBadge>
      </div>

      <div className="metric-grid setup-summary-grid">
        <div className="metric">
          <span>Actions</span>
          <strong>{draft.actions.length}</strong>
        </div>
        <div className="metric">
          <span>Bodies</span>
          <strong>{draftSummary.bodies}</strong>
        </div>
        <div className="metric">
          <span>Roles</span>
          <strong>{draftSummary.roles}</strong>
        </div>
        <div className="metric">
          <span>Mandates</span>
          <strong>{draftSummary.mandates}</strong>
        </div>
        <div className="metric">
          <span>Policy routes</span>
          <strong>{draftSummary.policies}</strong>
        </div>
      </div>

      <ValidationSummaryPanel
        readiness={readiness}
        summary={validationSummary}
      />

      <dl className="detail-list detail-list-wide setup-draft-details">
        <div>
          <dt>Draft ID</dt>
          <dd className="mono-value">{draft.draftId}</dd>
        </div>
        <div>
          <dt>Template</dt>
          <dd>{draft.templateId ?? "Manual draft"}</dd>
        </div>
        <div>
          <dt>Chain</dt>
          <dd>{draft.chainId}</dd>
        </div>
        {draft.organization ? (
          <>
            <div>
              <dt>Organization</dt>
              <dd>{draft.organization.fallbackName}</dd>
            </div>
            <div>
              <dt>Admin</dt>
              <dd className="mono-value">
                {draft.organization.adminAddress
                  ? formatDraftAddress(draft.organization.adminAddress)
                  : "Not set"}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      <WarningsList warnings={draft.warnings} />

      <div className="setup-action-groups">
        {SETUP_ACTION_GROUPS.map((group) => (
          <SetupActionGroupPanel
            actions={draft.actions.filter((action) =>
              group.kinds.includes(action.kind),
            )}
            group={group}
            key={group.key}
          />
        ))}
      </div>
    </section>
  );
}

function SetupActionGroupPanel({
  actions,
  group,
}: {
  readonly actions: readonly SetupAction[];
  readonly group: SetupActionGroup;
}): JSX.Element {
  return (
    <section className="setup-action-group">
      <div className="setup-action-group-header">
        <h3>{group.label}</h3>
        <span>{actions.length} actions</span>
      </div>
      {actions.length === 0 ? (
        <div className="setup-action-empty">No draft actions in this group.</div>
      ) : (
        <div className="setup-action-list">
          {actions.map((action, index) => (
            <SetupActionRow
              action={action}
              index={index + 1}
              key={action.actionId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SetupActionRow({
  action,
  index,
}: {
  readonly action: SetupAction;
  readonly index: number;
}): JSX.Element {
  return (
    <article className="setup-action-row">
      <div className="setup-action-row-top">
        <div className="setup-action-main">
          <span className="setup-action-index">{index}</span>
          <div>
            <strong>{action.label}</strong>
            <span>{getActionSummary(action)}</span>
          </div>
        </div>
        <div className="setup-action-meta">
          <StatusBadge tone="muted">{formatLabel(action.kind)}</StatusBadge>
          <StatusBadge tone="warning">
            {formatLabel(action.executionStatus)}
          </StatusBadge>
        </div>
      </div>
      <ActionWarnings warnings={action.warnings} />
    </article>
  );
}

function ActionWarnings({
  warnings,
}: {
  readonly warnings: readonly SetupValidationWarning[];
}): JSX.Element | null {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="setup-action-warning-list">
      {warnings.map((warning, index) => (
        <span
          className={`setup-action-warning setup-action-warning-${warning.severity}`}
          key={`${warning.code}:${warning.message}:${index}`}
        >
          {formatLabel(warning.severity)} - {formatLabel(warning.code)}:{" "}
          {warning.message}
        </span>
      ))}
    </div>
  );
}

function ValidationSummaryPanel({
  readiness,
  summary,
}: {
  readonly readiness: DraftReadiness;
  readonly summary: SetupValidationSummary;
}): JSX.Element {
  return (
    <div className="setup-validation-summary">
      <div className={`setup-validation-state ${readiness.className}`}>
        <div>
          <strong>{readiness.label}</strong>
          <span>{readiness.description}</span>
        </div>
        <StatusBadge tone={readiness.tone}>{formatLabel(readiness.status)}</StatusBadge>
      </div>
      <div className="setup-validation-counts">
        <ValidationCount
          label="Errors"
          severity="error"
          value={summary.errors}
        />
        <ValidationCount
          label="Warnings"
          severity="warning"
          value={summary.warnings}
        />
        <ValidationCount label="Info" severity="info" value={summary.info} />
      </div>
      <p className="setup-validation-note">
        Errors block future execution readiness. Warnings are advisory where
        protocol transactions could still be valid. Info explains draft
        assumptions.
      </p>
    </div>
  );
}

function ValidationCount({
  label,
  severity,
  value,
}: {
  readonly label: string;
  readonly severity: SetupValidationWarningSeverity;
  readonly value: number;
}): JSX.Element {
  return (
    <div className={`setup-validation-count setup-validation-count-${severity}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WarningsList({
  warnings,
}: {
  readonly warnings: readonly SetupValidationWarning[];
}): JSX.Element | null {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="setup-warning-list">
      {warnings.map((warning, index) => (
        <div
          className={`blocked-reason ${getWarningReasonClass(
            warning.severity,
          )}`}
          key={`${warning.code}:${warning.message}:${index}`}
        >
          <div className="blocked-reason-header">
            <strong>{formatLabel(warning.code)}</strong>
            <StatusBadge tone={getWarningTone(warning.severity)}>
              {formatLabel(warning.severity)}
            </StatusBadge>
          </div>
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}

function summarizeDraft(draft: SetupDraft): {
  readonly bodies: number;
  readonly mandates: number;
  readonly policies: number;
  readonly roles: number;
} {
  return {
    bodies: draft.actions.filter(
      (action) => action.kind === SetupActionKind.CreateBody,
    ).length,
    policies: draft.actions.filter(
      (action) => action.kind === SetupActionKind.SetPolicyRule,
    ).length,
    mandates: draft.actions.filter(
      (action) => action.kind === SetupActionKind.AssignMandate,
    ).length,
    roles: draft.actions.filter(
      (action) => action.kind === SetupActionKind.CreateRole,
    ).length,
  };
}

interface DraftReadiness {
  readonly className: string;
  readonly description: string;
  readonly label: string;
  readonly status: SetupDraftStatus;
  readonly tone: "default" | "success" | "warning" | "danger" | "muted";
}

function getDraftReadiness(
  draft: SetupDraft,
  summary: SetupValidationSummary,
): DraftReadiness {
  if (summary.blocked || draft.status === SetupDraftStatus.Blocked) {
    return {
      className: "setup-validation-state-danger",
      description:
        "Error-level validation warnings must be resolved before this draft is ready for setup transaction execution.",
      label: "Blocked",
      status: SetupDraftStatus.Blocked,
      tone: "danger",
    };
  }

  if (draft.status === SetupDraftStatus.ReadyForReview) {
    return {
      className: "setup-validation-state-success",
      description:
        "No blocking validation errors were found. The draft remains editable and no transaction is sent from this preview.",
      label: "Ready for review",
      status: draft.status,
      tone: "success",
    };
  }

  return {
    className: "setup-validation-state-warning",
    description:
      "The draft is still editable. Review validation output before any future setup execution step.",
    label: "Editable draft",
    status: draft.status,
    tone: "warning",
  };
}

function getWarningTone(
  severity: SetupValidationWarningSeverity,
): "default" | "warning" | "danger" | "muted" {
  switch (severity) {
    case "error":
      return "danger";
    case "warning":
      return "warning";
    case "info":
      return "default";
  }
}

function getWarningReasonClass(
  severity: SetupValidationWarningSeverity,
): string {
  switch (severity) {
    case "error":
      return "blocked-reason-danger";
    case "warning":
      return "blocked-reason-warning";
    case "info":
      return "blocked-reason-info";
  }
}

function getActionSummary(action: SetupAction): string {
  switch (action.kind) {
    case SetupActionKind.CreateOrganization:
      return getCreateOrganizationSummary(action);
    case SetupActionKind.CreateBody:
      return getCreateBodySummary(action);
    case SetupActionKind.CreateRole:
      return getCreateRoleSummary(action);
    case SetupActionKind.AssignMandate:
      return getAssignMandateSummary(action);
    case SetupActionKind.SetPolicyRule:
      return getSetPolicyRuleSummary(action);
  }
}

function getCreateOrganizationSummary(
  action: CreateOrganizationSetupAction,
): string {
  const metadata = action.metadataUri ? `; metadata ${action.metadataUri}` : "";
  return `${action.fallbackName}; admin ${formatDraftAddress(
    action.adminAddress,
  )}${metadata}`;
}

function getCreateBodySummary(action: CreateBodySetupAction): string {
  return `${formatLabel(action.bodyKind)}; ${
    action.active ? "active" : "inactive"
  }`;
}

function getCreateRoleSummary(action: CreateRoleSetupAction): string {
  return `${formatLabel(action.roleType)} in ${formatReference(action.bodyRef)}`;
}

function getAssignMandateSummary(action: AssignMandateSetupAction): string {
  const scopes = action.proposalTypes?.map(formatLabel).join(", ");
  return `${formatDraftAddress(action.holderAddress)}; scope ${
    scopes ?? `mask ${action.proposalTypeMask}`
  }`;
}

function getSetPolicyRuleSummary(action: SetPolicyRuleSetupAction): string {
  const approvals = formatReferences(action.requiredApprovalBodies);
  const vetoes = formatReferences(action.vetoBodies);
  const executor = action.executorBody
    ? formatReference(action.executorBody)
    : "none";
  return `${formatLabel(
    action.proposalType,
  )}; approvals ${approvals}; veto ${vetoes}; executor ${executor}; timelock ${formatNumericString(
    action.timelockSeconds,
  )}s`;
}

function formatReferences(references: readonly SetupEntityReference[]): string {
  return references.length === 0
    ? "none"
    : references.map(formatReference).join(", ");
}

function formatReference(reference: SetupEntityReference): string {
  if (reference.indexedId) {
    return `#${reference.indexedId}`;
  }

  return reference.draftId ?? "unresolved";
}

function formatDraftAddress(value: string): string {
  if (value.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return "Zero address";
  }

  return formatAddress(value);
}
