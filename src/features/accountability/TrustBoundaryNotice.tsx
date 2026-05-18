import type { SourceDisclosureDto } from "@isonia/types";
import {
  formatAuthorityClaim,
  formatExternalSourceLabel,
  formatIsoDateTime,
  formatTrustBoundary,
  trustBoundaryMessage,
} from "./accountability-display";

interface TrustBoundaryNoticeProps {
  readonly disclosure?: SourceDisclosureDto;
  readonly title?: string;
}

export function TrustBoundaryNotice({
  disclosure,
  title = "Source boundary",
}: TrustBoundaryNoticeProps): JSX.Element {
  return (
    <div className="trust-boundary-notice">
      <div>
        <strong>{title}</strong>
        <span>{trustBoundaryMessage(disclosure)}</span>
      </div>
      {disclosure ? (
        <dl className="trust-boundary-meta">
          <div>
            <dt>Source</dt>
            <dd>{formatExternalSourceLabel(disclosure.sourceLabel)}</dd>
          </div>
          <div>
            <dt>Boundary</dt>
            <dd>{formatTrustBoundary(disclosure.trustBoundary)}</dd>
          </div>
          <div>
            <dt>Authority</dt>
            <dd>{formatAuthorityClaim(disclosure.authorityClaim)}</dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>{formatIsoDateTime(disclosure.observedAt)}</dd>
          </div>
        </dl>
      ) : null}
      {disclosure?.note ? (
        <p className="trust-boundary-note">{disclosure.note}</p>
      ) : null}
    </div>
  );
}
