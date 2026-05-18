import type {
  ArchiveProposalSummaryDto,
  PublicOrganizationArchiveDto,
} from "@isonia/types";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useMetadata } from "../../metadata/MetadataProvider";
import { AsyncContent } from "../../ui/AsyncContent";
import { PageHeader } from "../../ui/PageHeader";
import { IsoStatusPill } from "../../ui-kit";
import { organizationDisplay } from "../../utils/display-labels";
import { requireParam } from "../../utils/route-params";
import { SourceDisclosureBadge } from "../accountability/SourceDisclosureBadge";
import { TrustBoundaryNotice } from "../accountability/TrustBoundaryNotice";
import {
  ArchiveFilters,
  DEFAULT_ARCHIVE_FILTERS,
  type ArchiveFilterState,
} from "./ArchiveFilters";
import { ArchiveProposalList } from "./ArchiveProposalList";

export function PublicArchivePage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const archive = useIsoniaQuery(() => client.archive.get(orgId), [
    client,
    orgId,
  ]);

  return (
    <section className="page-stack archive-page-stack">
      <AsyncContent
        state={archive}
        loadingTitle="Loading public archive"
        loadingMessage="Reading proposal history, decision records, and accountability counts."
        emptyTitle="Archive not found"
        emptyMessage={`No public archive was found for org #${orgId}.`}
        errorTitle="Unable to load archive"
      >
        {(data) => <PublicArchiveContent archive={data} orgId={orgId} />}
      </AsyncContent>
    </section>
  );
}

function PublicArchiveContent({
  archive,
  orgId,
}: {
  readonly archive: PublicOrganizationArchiveDto;
  readonly orgId: string;
}): JSX.Element {
  const metadata = useMetadata(archive.organization.metadataUri);
  const display = organizationDisplay(archive.organization, metadata.record);
  const [filters, setFilters] = useState<ArchiveFilterState>(
    DEFAULT_ARCHIVE_FILTERS,
  );
  const filteredProposals = useMemo(
    () => filterArchiveProposals(archive.proposals, filters),
    [archive.proposals, filters],
  );

  return (
    <>
      <PageHeader
        eyebrow={display.subtitle ?? `Organization #${archive.organization.orgId}`}
        title={`${display.title} Archive`}
        description="Public governance archive for proposal history, evidence, decisions, and accountability records."
      />

      <section className="panel archive-disclosure-panel">
        <div className="panel-header">
          <div>
            <h2>Public Archive Scope</h2>
            <p className="panel-subtitle">
              The archive organizes governance records and evidence. It does not
              invent authority or promote external records into protocol truth.
            </p>
          </div>
          <div className="chip-row">
            <IsoStatusPill tone="muted">Read-only</IsoStatusPill>
            <SourceDisclosureBadge disclosure={archive.readModelStatus} />
          </div>
        </div>
        <TrustBoundaryNotice
          disclosure={archive.readModelStatus}
          title="Read model disclosure"
        />
      </section>

      <div className="metric-grid archive-metric-grid">
        <ArchiveMetric
          label="Active proposals"
          value={archive.counts.activeProposals}
        />
        <ArchiveMetric
          label="Awaiting execution"
          value={archive.counts.approvedAwaitingExecution}
        />
        <ArchiveMetric
          label="Executed decisions"
          value={archive.counts.executedDecisions}
        />
        <ArchiveMetric
          label="Failed/cancelled follow-through"
          value={archive.counts.failedOrCancelledFollowThrough}
        />
        <ArchiveMetric
          label="Missing evidence"
          value={archive.counts.proposalsWithMissingEvidence}
        />
        <ArchiveMetric
          label="Manual-only status records"
          value={archive.counts.manualOnlyStatusRecords}
        />
      </div>

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}/proposals`}>
          Proposals
        </Link>
        <Link className="button" to={`/orgs/${orgId}/governance`}>
          Governance Structure
        </Link>
      </div>

      <ArchiveFilters
        filters={filters}
        proposals={archive.proposals}
        onChange={setFilters}
      />
      <ArchiveProposalList orgId={orgId} proposals={filteredProposals} />
    </>
  );
}

function ArchiveMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): JSX.Element {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function filterArchiveProposals(
  proposals: readonly ArchiveProposalSummaryDto[],
  filters: ArchiveFilterState,
): readonly ArchiveProposalSummaryDto[] {
  return proposals.filter((proposal) => {
    if (
      filters.displayState !== "all" &&
      proposal.displayState !== filters.displayState
    ) {
      return false;
    }

    if (
      filters.proposalType !== "all" &&
      proposal.proposalType !== filters.proposalType
    ) {
      return false;
    }

    if (
      filters.executionStatus !== "all" &&
      proposal.executionStatus !== filters.executionStatus
    ) {
      return false;
    }

    if (filters.evidence === "missing-evidence" && proposal.evidenceCount > 0) {
      return false;
    }

    if (
      filters.evidence === "has-external-evidence" &&
      proposal.externalSourceCount === 0
    ) {
      return false;
    }

    return true;
  });
}
