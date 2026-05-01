import { Link } from "react-router-dom";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import type {
  SetupCompletionDependencyIssue,
  SetupCompletionIssue,
  SetupCompletionReadiness,
  SetupCompletionVerification,
} from "./setup-completion-verification";

export function SetupCompletionSummary({
  completion,
  error,
  loading,
  reload,
}: {
  readonly completion: SetupCompletionVerification;
  readonly error?: Error;
  readonly loading: boolean;
  readonly reload?: () => void;
}): JSX.Element {
  const readiness = getReadinessDisplay(completion.readiness);

  return (
    <section className="panel setup-completion-panel">
      <div className="panel-header">
        <div>
          <h2>Setup Completion</h2>
          <p className="panel-subtitle">
            Verifies the draft plan against indexed read models for the
            organization, bodies, roles, mandates, and policy rules.
          </p>
        </div>
        <StatusBadge tone={readiness.tone}>{readiness.label}</StatusBadge>
      </div>

      <div className={`setup-validation-state ${readiness.className}`}>
        <div>
          <strong>{readiness.label}</strong>
          <span>{readiness.description}</span>
        </div>
        <StatusBadge tone={readiness.tone}>
          {completion.readiness}
        </StatusBadge>
      </div>

      <div className="metric-grid setup-summary-grid setup-completion-grid">
        <CompletionMetric label="Total setup actions" value={completion.totalActions} />
        <CompletionMetric label="Indexed actions" value={completion.indexedActions} />
        <CompletionMetric label="Failed actions" value={completion.failedActions} />
        <CompletionMetric label="Blocked actions" value={completion.blockedActions} />
        <CompletionMetric
          label="Unresolved dependencies"
          value={completion.unresolvedDependencies.length}
        />
        <CompletionMetric
          label="Missing indexed entities"
          value={completion.missingIndexedEntities.length}
        />
        <CompletionMetric
          label="Unresolved policy rules"
          value={completion.unresolvedPolicyRules.length}
        />
      </div>

      {loading ? (
        <div className="inline-state inline-state-muted setup-completion-inline">
          <strong>Refreshing indexed read models</strong>
          <span>
            Completion is being checked against the latest Control Plane
            organization, topology, mandate, and policy responses.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="state-panel state-panel-error">
          <strong>Unable to verify indexed setup state</strong>
          <p>{error.message}</p>
          <div className="action-row">
            {reload ? (
              <button className="button" type="button" onClick={reload}>
                Retry
              </button>
            ) : null}
            <Link className="button" to="/diagnostics">
              Diagnostics
            </Link>
          </div>
        </div>
      ) : null}

      {completion.readiness === "completed" ? (
        <CompletedNextSteps orgId={completion.indexedOrgId} />
      ) : (
        <CompletionReasons completion={completion} />
      )}
    </section>
  );
}

function CompletionMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): JSX.Element {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CompletionReasons({
  completion,
}: {
  readonly completion: SetupCompletionVerification;
}): JSX.Element {
  const hasIssues =
    completion.failedActionIssues.length > 0 ||
    completion.blockedActionIssues.length > 0 ||
    completion.unresolvedDependencies.length > 0 ||
    completion.missingIndexedEntities.length > 0 ||
    completion.unresolvedPolicyRules.length > 0;

  if (!hasIssues) {
    return (
      <div className="inline-state inline-state-muted setup-completion-inline">
        <strong>No indexed setup actions yet</strong>
        <span>
          Completion will move forward when setup transactions are submitted,
          confirmed, indexed, and visible in the read models.
        </span>
      </div>
    );
  }

  return (
    <div className="setup-completion-issues">
      <IssueSection
        issues={completion.failedActionIssues}
        title="Failed actions"
        tone="danger"
      />
      <IssueSection
        issues={completion.blockedActionIssues}
        title="Blocked actions"
        tone="danger"
      />
      <DependencyIssueSection issues={completion.unresolvedDependencies} />
      <IssueSection
        issues={completion.missingIndexedEntities}
        title="Missing indexed entities"
        tone="warning"
      />
      <IssueSection
        issues={completion.unresolvedPolicyRules}
        title="Unresolved policy rules"
        tone="warning"
      />
    </div>
  );
}

function IssueSection({
  issues,
  title,
  tone,
}: {
  readonly issues: readonly SetupCompletionIssue[];
  readonly title: string;
  readonly tone: "danger" | "warning";
}): JSX.Element | null {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="blocked-reason-list">
      <div className="setup-action-group-header">
        <h3>{title}</h3>
        <span>{issues.length} actions</span>
      </div>
      {issues.map((issue) => (
        <article
          className={`blocked-reason ${
            tone === "danger" ? "blocked-reason-danger" : ""
          }`}
          key={`${issue.actionId}:${issue.message}`}
        >
          <div className="blocked-reason-header">
            <strong>{issue.label}</strong>
            <StatusBadge tone={tone}>{formatLabel(issue.actionKind)}</StatusBadge>
          </div>
          <span>{issue.message}</span>
        </article>
      ))}
    </section>
  );
}

function DependencyIssueSection({
  issues,
}: {
  readonly issues: readonly SetupCompletionDependencyIssue[];
}): JSX.Element | null {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="blocked-reason-list">
      <div className="setup-action-group-header">
        <h3>Unresolved dependencies</h3>
        <span>{issues.length} dependencies</span>
      </div>
      {issues.map((issue) => (
        <article
          className="blocked-reason"
          key={`${issue.actionId}:${issue.dependencyActionId}`}
        >
          <div className="blocked-reason-header">
            <strong>{issue.label}</strong>
            <StatusBadge tone="warning">
              {issue.dependencyLabel}
            </StatusBadge>
          </div>
          <span>{issue.message}</span>
        </article>
      ))}
    </section>
  );
}

function CompletedNextSteps({
  orgId,
}: {
  readonly orgId: string | undefined;
}): JSX.Element {
  if (!orgId) {
    return (
      <div className="inline-state inline-state-muted setup-completion-inline">
        <strong>Setup is indexed</strong>
        <span>
          The verifier found every setup action, but no organization route is
          available for next-step links.
        </span>
      </div>
    );
  }

  return (
    <div className="setup-completion-next">
      <Link className="button button-primary" to={`/orgs/${orgId}/governance`}>
        Governance Structure / Power Map
      </Link>
      <Link className="button" to={`/orgs/${orgId}/setup#indexed-policies`}>
        Indexed Policies
      </Link>
      <Link className="button" to={`/orgs/${orgId}/proposals/new`}>
        Proposal Creation
      </Link>
      <Link className="button" to="/diagnostics">
        Diagnostics
      </Link>
    </div>
  );
}

function getReadinessDisplay(readiness: SetupCompletionReadiness): {
  readonly className: string;
  readonly description: string;
  readonly label: string;
  readonly tone: "default" | "success" | "warning" | "danger" | "muted";
} {
  switch (readiness) {
    case "completed":
      return {
        className: "setup-validation-state-success",
        description:
          "Every expected setup action has a corresponding indexed read-model result.",
        label: "Completed",
        tone: "success",
      };
    case "blocked":
      return {
        className: "setup-validation-state-danger",
        description:
          "A failed action, validation blocker, or blocked dependency is preventing completion.",
        label: "Blocked",
        tone: "danger",
      };
    case "in_progress":
      return {
        className: "setup-validation-state-warning",
        description:
          "A setup transaction is still waiting for wallet signing, confirmation, indexing, or projection.",
        label: "In progress",
        tone: "warning",
      };
    case "partially_indexed":
      return {
        className: "setup-validation-state-warning",
        description:
          "Some setup read models are indexed, but the full expected Simple DAO+ topology is not complete yet.",
        label: "Partially indexed",
        tone: "warning",
      };
    case "not_started":
      return {
        className: "setup-validation-state-warning",
        description:
          "No expected setup action has reached indexed read-model state yet.",
        label: "Not started",
        tone: "muted",
      };
  }
}
