import type {
  ExternalResourceDto,
  ExternalResourceRefDto,
} from "@isonia/types";
import type { ReactNode } from "react";
import { IsoStatusPill } from "../../ui-kit";
import { formatLabel } from "../../utils/format";
import {
  formatAuthorityClaim,
  formatExternalSourceLabel,
  formatIsoDateTime,
  formatOptionalText,
  formatTrustBoundary,
} from "./accountability-display";
import { SourceDisclosureBadge } from "./SourceDisclosureBadge";
import { TrustBoundaryNotice } from "./TrustBoundaryNotice";

interface ExternalResourceCardProps {
  readonly resource: ExternalResourceDto;
}

export function ExternalResourceCard({
  resource,
}: ExternalResourceCardProps): JSX.Element {
  const title =
    resource.title?.trim() || resource.canonicalRef?.trim() || resource.url;

  return (
    <article className="external-resource-card">
      <header className="external-resource-header">
        <div>
          <h3>{title}</h3>
          <span>{formatLabel(resource.provider)}</span>
        </div>
        <SourceDisclosureBadge
          authorityClaim={resource.authorityClaim}
          disclosure={resource.sourceDisclosure}
          sourceLabel={resource.sourceLabel}
          trustBoundary={resource.trustBoundary}
        />
      </header>

      <TrustBoundaryNotice disclosure={resource.sourceDisclosure} />

      <dl className="accountability-detail-grid">
        <Detail label="Relation" value={formatLabel(resource.relation)} />
        <Detail
          label="Source"
          value={formatExternalSourceLabel(resource.sourceLabel)}
        />
        <Detail
          label="Trust boundary"
          value={formatTrustBoundary(resource.trustBoundary)}
        />
        <Detail
          label="Authority claim"
          value={formatAuthorityClaim(resource.authorityClaim)}
        />
        <Detail
          label="Import status"
          value={
            resource.importStatus ? formatLabel(resource.importStatus) : "Not set"
          }
        />
        <Detail
          label="Verification"
          value={formatOptionalText(resource.verificationMethod)}
        />
        <Detail label="Observed" value={formatIsoDateTime(resource.observedAt)} />
        <Detail label="Imported" value={formatIsoDateTime(resource.importedAt)} />
      </dl>

      <div className="external-resource-link-row">
        <a href={resource.url} rel="noreferrer" target="_blank">
          Open external record
        </a>
        <code>{resource.canonicalRef ?? resource.id}</code>
      </div>
    </article>
  );
}

export function ExternalResourceRefList({
  emptyMessage = "No evidence references were reported.",
  refs,
}: {
  readonly emptyMessage?: string;
  readonly refs: readonly ExternalResourceRefDto[];
}): JSX.Element {
  if (refs.length === 0) {
    return (
      <div className="calm-state">
        <strong>No evidence references</strong>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="external-resource-ref-list">
      {refs.map((ref) => (
        <a
          className="external-resource-ref"
          href={ref.url}
          key={ref.id}
          rel="noreferrer"
          target="_blank"
        >
          <div>
            <strong>{ref.id}</strong>
            <span>
              {ref.provider ? formatLabel(ref.provider) : "External resource"}
              {ref.relation ? ` - ${formatLabel(ref.relation)}` : ""}
            </span>
          </div>
          <div className="chip-row">
            <SourceDisclosureBadge
              sourceLabel={ref.sourceLabel}
              trustBoundary={ref.trustBoundary}
            />
            {ref.authorityClaim ? (
              <IsoStatusPill tone="muted">
                {formatAuthorityClaim(ref.authorityClaim)}
              </IsoStatusPill>
            ) : null}
          </div>
        </a>
      ))}
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
