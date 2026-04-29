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
  TemplateDescriptor,
} from "@isonia/types";
import { SetupActionKind } from "@isonia/types";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatLabel,
  formatNumericString,
} from "../../utils/format";

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
  const summary = summarizeDraft(draft);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Setup Draft</h2>
          <p className="panel-subtitle">
            Browser-side placeholder state for the selected template. It is not
            submitted, indexed, or authoritative.
          </p>
        </div>
        <StatusBadge tone="warning">{formatLabel(draft.status)}</StatusBadge>
      </div>

      <div className="metric-grid setup-summary-grid">
        <div className="metric">
          <span>Actions</span>
          <strong>{draft.actions.length}</strong>
        </div>
        <div className="metric">
          <span>Bodies</span>
          <strong>{summary.bodies}</strong>
        </div>
        <div className="metric">
          <span>Roles</span>
          <strong>{summary.roles}</strong>
        </div>
        <div className="metric">
          <span>Policy routes</span>
          <strong>{summary.policies}</strong>
        </div>
      </div>

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
      </dl>

      <WarningsList warnings={draft.warnings} />

      <div className="setup-action-list">
        {draft.actions.map((action, index) => (
          <SetupActionRow
            action={action}
            index={index + 1}
            key={action.actionId}
          />
        ))}
      </div>
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
    </article>
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
      {warnings.map((warning) => (
        <div
          className="blocked-reason"
          key={`${warning.code}:${warning.message}`}
        >
          <div className="blocked-reason-header">
            <strong>{formatLabel(warning.code)}</strong>
            <StatusBadge
              tone={warning.severity === "error" ? "danger" : "warning"}
            >
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
    roles: draft.actions.filter(
      (action) => action.kind === SetupActionKind.CreateRole,
    ).length,
  };
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
  return `${action.fallbackName}; admin ${formatAddress(action.adminAddress)}`;
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
  return `${formatAddress(action.holderAddress)}; scope ${
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
