import type {
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
  SourceDisclosureDto,
} from "@isonia/types";
import { IsoStatusPill } from "../../ui-kit";
import {
  formatAuthorityClaim,
  formatExternalSourceLabel,
  formatTrustBoundary,
  sourceDisclosureTone,
} from "./accountability-display";

interface SourceDisclosureBadgeProps {
  readonly authorityClaim?: ExternalAuthorityClaim | string;
  readonly className?: string;
  readonly disclosure?: SourceDisclosureDto;
  readonly sourceLabel?: ExternalSourceLabel | string;
  readonly trustBoundary?: ExternalTrustBoundary | string;
}

export function SourceDisclosureBadge({
  authorityClaim,
  className,
  disclosure,
  sourceLabel,
  trustBoundary,
}: SourceDisclosureBadgeProps): JSX.Element {
  const effective = {
    authorityClaim: disclosure?.authorityClaim ?? authorityClaim,
    sourceLabel: disclosure?.sourceLabel ?? sourceLabel,
    trustBoundary: disclosure?.trustBoundary ?? trustBoundary,
  };
  const label =
    effective.authorityClaim !== undefined
      ? formatAuthorityClaim(effective.authorityClaim)
      : formatExternalSourceLabel(effective.sourceLabel);
  const title = [
    formatExternalSourceLabel(effective.sourceLabel),
    formatTrustBoundary(effective.trustBoundary),
    formatAuthorityClaim(effective.authorityClaim),
  ].join(" - ");

  return (
    <IsoStatusPill
      className={["source-disclosure-badge", className]
        .filter(Boolean)
        .join(" ")}
      tone={sourceDisclosureTone(effective)}
    >
      <span title={title}>{label}</span>
    </IsoStatusPill>
  );
}
