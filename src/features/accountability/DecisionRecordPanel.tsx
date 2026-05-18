import type { DecisionRecordDto } from "@isonia/types";
import type { ReactNode } from "react";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { IsoStatusPill } from "../../ui-kit";
import { formatLabel } from "../../utils/format";
import {
  decisionResultTone,
  formatIsoDateTime,
  formatOptionalText,
  isNotFoundApiError,
} from "./accountability-display";
import { ExternalResourceRefList } from "./ExternalResourceCard";
import { SourceDisclosureBadge } from "./SourceDisclosureBadge";
import { TrustBoundaryNotice } from "./TrustBoundaryNotice";

interface DecisionRecordPanelProps {
  readonly orgId: string;
  readonly proposalId: string;
}

export function DecisionRecordPanel({
  orgId,
  proposalId,
}: DecisionRecordPanelProps): JSX.Element {
  const client = useIsoniaClient();
  const decision = useIsoniaQuery(
    () => client.decisionRecords.get(orgId, proposalId),
    [client, orgId, proposalId],
  );

  if (decision.loading) {
    return (
      <AccountabilityState
        title="Loading decision record"
        message="Reading the v0.8 decision read model."
      />
    );
  }

  if (isNotFoundApiError(decision.error)) {
    return (
      <AccountabilityState
        title="Decision record not available yet"
        message="This Control Plane does not have a v0.8 decision record for this proposal yet. The proposal lifecycle view remains available."
      />
    );
  }

  if (decision.error) {
    return (
      <AccountabilityState
        actionLabel="Retry"
        message={decision.error.message}
        title="Unable to load decision record"
        onAction={decision.reload}
      />
    );
  }

  if (!decision.data) {
    return (
      <AccountabilityState
        title="Decision record missing"
        message="No decision record was returned for this proposal."
      />
    );
  }

  return <DecisionRecordContent record={decision.data} />;
}

function DecisionRecordContent({
  record,
}: {
  readonly record: DecisionRecordDto;
}): JSX.Element {
  return (
    <div className="accountability-panel-stack">
      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Decision Record</h2>
            <p>
              Contract/onchain state is authority for Isonia governance state.
              External/manual evidence is context or annotation unless explicitly
              modeled otherwise.
            </p>
          </div>
          <div className="chip-row">
            <IsoStatusPill tone={decisionResultTone(record.decisionResult)}>
              {formatLabel(record.decisionResult)}
            </IsoStatusPill>
            <SourceDisclosureBadge disclosure={record.sourceDisclosure} />
          </div>
        </div>

        <TrustBoundaryNotice disclosure={record.sourceDisclosure} />

        <dl className="accountability-detail-grid">
          <Detail label="Decision result" value={formatLabel(record.decisionResult)} />
          <Detail
            label="Execution required"
            value={record.requiresExecution ? "Required" : "Not required"}
          />
          <Detail
            label="Responsible party"
            value={formatOptionalText(record.responsiblePartyLabel)}
          />
          <Detail label="Due date" value={formatIsoDateTime(record.dueDate)} />
          <Detail
            label="Accountability record"
            value={formatOptionalText(record.accountabilityRecordId)}
          />
          <Detail label="Record ID" value={record.id} mono />
        </dl>
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Approval Summary</h2>
            <p>Approval route materialized into the decision record.</p>
          </div>
        </div>
        {record.approvalSummary ? (
          <dl className="accountability-detail-grid">
            <Detail
              label="Required approvals"
              value={
                record.approvalSummary.requiredApprovals?.join(", ") || "Not set"
              }
            />
            <Detail
              label="Collected approvals"
              value={
                record.approvalSummary.collectedApprovals?.join(", ") || "None"
              }
            />
            <Detail
              label="Veto state"
              value={
                record.approvalSummary.vetoState
                  ? formatLabel(record.approvalSummary.vetoState)
                  : "Not set"
              }
            />
            <Detail
              label="Policy version"
              value={
                record.approvalSummary.policyVersion
                  ? `v${record.approvalSummary.policyVersion}`
                  : "Not set"
              }
            />
          </dl>
        ) : (
          <AccountabilityState
            title="Approval summary unavailable"
            message="The decision record did not include approval summary details."
          />
        )}
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Timestamps</h2>
            <p>Recorded proposal and archive milestones.</p>
          </div>
        </div>
        <dl className="accountability-detail-grid">
          <Detail label="Proposed" value={formatIsoDateTime(record.timestamps.proposedAt)} />
          <Detail label="Decided" value={formatIsoDateTime(record.timestamps.decidedAt)} />
          <Detail label="Queued" value={formatIsoDateTime(record.timestamps.queuedAt)} />
          <Detail label="Executed" value={formatIsoDateTime(record.timestamps.executedAt)} />
          <Detail label="Archived" value={formatIsoDateTime(record.timestamps.archivedAt)} />
        </dl>
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Evidence References</h2>
            <p>Evidence attached to the decision record by the Control Plane.</p>
          </div>
        </div>
        <ExternalResourceRefList refs={record.evidence} />
      </section>

      {record.finalOutcome ? (
        <section className="product-card">
          <div className="product-card-header">
            <div>
              <h2>Final Outcome</h2>
              <p>Outcome annotation linked to this decision record.</p>
            </div>
            <SourceDisclosureBadge disclosure={record.finalOutcome.sourceDisclosure} />
          </div>
          <TrustBoundaryNotice disclosure={record.finalOutcome.sourceDisclosure} />
          <dl className="accountability-detail-grid">
            <Detail label="Status" value={formatLabel(record.finalOutcome.status)} />
            <Detail
              label="Recorded"
              value={formatIsoDateTime(record.finalOutcome.recordedAt)}
            />
            <Detail
              label="Reason"
              value={formatOptionalText(record.finalOutcome.reason)}
            />
            <Detail label="Note" value={formatOptionalText(record.finalOutcome.note)} />
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "technical-code" : undefined}>{value}</dd>
    </div>
  );
}

function AccountabilityState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="calm-state accountability-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {onAction && actionLabel ? (
        <button className="button button-small" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
