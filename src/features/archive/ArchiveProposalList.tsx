import type { ArchiveProposalSummaryDto } from "@isonia/types";
import { Link } from "react-router-dom";
import { IsoStatusPill } from "../../ui-kit";
import { formatLabel } from "../../utils/format";
import {
  decisionResultTone,
  displayStateTone,
  executionStatusTone,
  formatIsoDateTime,
  formatOptionalText,
} from "../accountability/accountability-display";
import { SourceDisclosureBadge } from "../accountability/SourceDisclosureBadge";

interface ArchiveProposalListProps {
  readonly orgId: string;
  readonly proposals: readonly ArchiveProposalSummaryDto[];
}

export function ArchiveProposalList({
  orgId,
  proposals,
}: ArchiveProposalListProps): JSX.Element {
  if (proposals.length === 0) {
    return (
      <section className="panel">
        <div className="inline-state inline-state-muted archive-empty-state">
          <strong>No proposals match these filters</strong>
          <span>Adjust the archive filters to see more proposal records.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel archive-proposal-panel">
      <div className="panel-header">
        <div>
          <h2>Proposal History</h2>
          <p className="panel-subtitle">
            Read-only archive records with source and evidence counts.
          </p>
        </div>
        <IsoStatusPill tone="muted">{proposals.length} shown</IsoStatusPill>
      </div>
      <div className="table-wrap archive-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proposal</th>
              <th>Type</th>
              <th>Contract</th>
              <th>Archive state</th>
              <th>Decision</th>
              <th>Execution</th>
              <th>Responsible</th>
              <th>Evidence</th>
              <th>Updated</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => (
              <ArchiveProposalRow
                key={`${proposal.chainId}:${proposal.orgId}:${proposal.proposalId}`}
                orgId={orgId}
                proposal={proposal}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ArchiveProposalRow({
  orgId,
  proposal,
}: {
  readonly orgId: string;
  readonly proposal: ArchiveProposalSummaryDto;
}): JSX.Element {
  return (
    <tr>
      <td>
        <strong>{formatOptionalText(proposal.title, `Proposal #${proposal.proposalId}`)}</strong>
        <span className="table-subtext">Proposal #{proposal.proposalId}</span>
      </td>
      <td>{proposal.proposalType ? formatLabel(proposal.proposalType) : "Unknown"}</td>
      <td>
        {proposal.contractStatus ? (
          <IsoStatusPill tone="muted">
            {formatLabel(proposal.contractStatus)}
          </IsoStatusPill>
        ) : (
          "Not reported"
        )}
      </td>
      <td>
        <IsoStatusPill tone={displayStateTone(proposal.displayState)}>
          {formatLabel(proposal.displayState)}
        </IsoStatusPill>
      </td>
      <td>
        {proposal.decisionResult ? (
          <IsoStatusPill tone={decisionResultTone(proposal.decisionResult)}>
            {formatLabel(proposal.decisionResult)}
          </IsoStatusPill>
        ) : (
          "Not recorded"
        )}
      </td>
      <td>
        {proposal.executionStatus ? (
          <IsoStatusPill tone={executionStatusTone(proposal.executionStatus)}>
            {formatLabel(proposal.executionStatus)}
          </IsoStatusPill>
        ) : (
          "Not required"
        )}
      </td>
      <td>{formatOptionalText(proposal.responsiblePartyLabel)}</td>
      <td>
        <span className="archive-evidence-counts">
          <strong>{proposal.evidenceCount}</strong>
          <span>{proposal.externalSourceCount} external</span>
        </span>
      </td>
      <td>
        <span>{formatIsoDateTime(proposal.lastUpdatedAt)}</span>
        {proposal.dueDate ? (
          <span className="table-subtext">Due {formatIsoDateTime(proposal.dueDate)}</span>
        ) : null}
      </td>
      <td>
        <SourceDisclosureBadge disclosure={proposal.sourceDisclosure} />
      </td>
      <td className="table-action">
        <Link
          className="button button-small"
          to={`/orgs/${orgId}/proposals/${proposal.proposalId}`}
        >
          Open
        </Link>
      </td>
    </tr>
  );
}
