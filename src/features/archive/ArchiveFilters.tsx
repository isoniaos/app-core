import type { ArchiveProposalSummaryDto } from "@isonia/types";
import { useMemo } from "react";
import { formatLabel } from "../../utils/format";

export type ArchiveEvidenceFilter =
  | "all"
  | "missing-evidence"
  | "has-external-evidence";

export interface ArchiveFilterState {
  readonly displayState: string;
  readonly evidence: ArchiveEvidenceFilter;
  readonly executionStatus: string;
  readonly proposalType: string;
}

export const DEFAULT_ARCHIVE_FILTERS: ArchiveFilterState = {
  displayState: "all",
  evidence: "all",
  executionStatus: "all",
  proposalType: "all",
};

interface ArchiveFiltersProps {
  readonly filters: ArchiveFilterState;
  readonly onChange: (filters: ArchiveFilterState) => void;
  readonly proposals: readonly ArchiveProposalSummaryDto[];
}

export function ArchiveFilters({
  filters,
  onChange,
  proposals,
}: ArchiveFiltersProps): JSX.Element {
  const options = useMemo(() => buildFilterOptions(proposals), [proposals]);

  function updateFilter(nextFilters: Partial<ArchiveFilterState>): void {
    onChange({ ...filters, ...nextFilters });
  }

  return (
    <section className="panel archive-filter-panel">
      <div className="panel-header">
        <div>
          <h2>Archive Filters</h2>
          <p className="panel-subtitle">
            Filters are applied in the browser to the current archive snapshot.
          </p>
        </div>
      </div>
      <div className="archive-filter-grid">
        <label className="form-field">
          <span>Display state</span>
          <select
            value={filters.displayState}
            onChange={(event) =>
              updateFilter({ displayState: event.currentTarget.value })
            }
          >
            <option value="all">All states</option>
            {options.displayStates.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Proposal type</span>
          <select
            value={filters.proposalType}
            onChange={(event) =>
              updateFilter({ proposalType: event.currentTarget.value })
            }
          >
            <option value="all">All types</option>
            {options.proposalTypes.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Execution status</span>
          <select
            value={filters.executionStatus}
            onChange={(event) =>
              updateFilter({ executionStatus: event.currentTarget.value })
            }
          >
            <option value="all">All execution states</option>
            {options.executionStatuses.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Evidence</span>
          <select
            value={filters.evidence}
            onChange={(event) =>
              updateFilter({
                evidence: event.currentTarget.value as ArchiveEvidenceFilter,
              })
            }
          >
            <option value="all">All evidence states</option>
            <option value="missing-evidence">Missing evidence</option>
            <option value="has-external-evidence">Has external evidence</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function buildFilterOptions(
  proposals: readonly ArchiveProposalSummaryDto[],
): {
  readonly displayStates: readonly string[];
  readonly executionStatuses: readonly string[];
  readonly proposalTypes: readonly string[];
} {
  return {
    displayStates: sortedUnique(proposals.map((proposal) => proposal.displayState)),
    executionStatuses: sortedUnique(
      proposals.map((proposal) => proposal.executionStatus),
    ),
    proposalTypes: sortedUnique(proposals.map((proposal) => proposal.proposalType)),
  };
}

function sortedUnique<T extends string>(
  values: readonly (T | undefined)[],
): readonly string[] {
  return [...new Set(values.filter((value): value is T => value !== undefined))].sort(
    (left, right) => left.localeCompare(right),
  );
}
