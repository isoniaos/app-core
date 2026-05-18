import {
  AccountabilityExecutionStatus,
  ArchiveProposalDisplayState,
  DecisionRecordResult,
  EXTERNAL_SOURCE_LABEL_TEXT,
  EXTERNAL_TRUST_BOUNDARY_TEXT,
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
} from "@isonia/types";
import { IsoniaApiError } from "@isonia/sdk";
import type { IsoStatusPillTone } from "../../ui-kit";
import { formatLabel } from "../../utils/format";

export function formatOptionalText(
  value: string | undefined,
  fallback = "Not provided",
): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function formatIsoDateTime(value: string | undefined): string {
  if (!value) {
    return "Not set";
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function formatExternalSourceLabel(
  value: ExternalSourceLabel | string | undefined,
): string {
  if (!value) {
    return "Source not disclosed";
  }

  return (
    EXTERNAL_SOURCE_LABEL_TEXT[value as ExternalSourceLabel] ?? formatLabel(value)
  );
}

export function formatTrustBoundary(
  value: ExternalTrustBoundary | string | undefined,
): string {
  if (!value) {
    return "Trust boundary not disclosed";
  }

  return (
    EXTERNAL_TRUST_BOUNDARY_TEXT[value as ExternalTrustBoundary] ??
    formatLabel(value)
  );
}

export function formatAuthorityClaim(
  value: ExternalAuthorityClaim | string | undefined,
): string {
  if (!value) {
    return "Authority not claimed";
  }

  if (value === ExternalAuthorityClaim.ContractAuthoritative) {
    return "Contract authoritative";
  }

  if (value === ExternalAuthorityClaim.SourceAuthoritativeForExternalField) {
    return "Authoritative for external field";
  }

  if (value === ExternalAuthorityClaim.EvidenceOnly) {
    return "Evidence only";
  }

  if (value === ExternalAuthorityClaim.ContextOnly) {
    return "Context only";
  }

  if (value === ExternalAuthorityClaim.None) {
    return "No authority claim";
  }

  return formatLabel(value);
}

export function sourceDisclosureTone(
  disclosure:
    | {
        readonly authorityClaim?: ExternalAuthorityClaim | string;
        readonly sourceLabel?: ExternalSourceLabel | string;
        readonly trustBoundary?: ExternalTrustBoundary | string;
      }
    | undefined,
): IsoStatusPillTone {
  if (!disclosure) {
    return "muted";
  }

  if (disclosure.authorityClaim === ExternalAuthorityClaim.ContractAuthoritative) {
    return "success";
  }

  if (
    disclosure.trustBoundary === ExternalTrustBoundary.UnverifiedLink ||
    disclosure.trustBoundary === ExternalTrustBoundary.ImportPreview
  ) {
    return "warning";
  }

  if (
    disclosure.sourceLabel === ExternalSourceLabel.ManualEvidence ||
    disclosure.trustBoundary === ExternalTrustBoundary.ManualContext
  ) {
    return "warning";
  }

  if (disclosure.sourceLabel === ExternalSourceLabel.OnchainTransaction) {
    return "default";
  }

  return "muted";
}

export function displayStateTone(
  state: ArchiveProposalDisplayState | string,
): IsoStatusPillTone {
  if (
    state === ArchiveProposalDisplayState.Executed ||
    state === ArchiveProposalDisplayState.Approved
  ) {
    return "success";
  }

  if (
    state === ArchiveProposalDisplayState.Cancelled ||
    state === ArchiveProposalDisplayState.ExecutionFailed ||
    state === ArchiveProposalDisplayState.Rejected
  ) {
    return "danger";
  }

  if (
    state === ArchiveProposalDisplayState.Active ||
    state === ArchiveProposalDisplayState.ExecutionPending ||
    state === ArchiveProposalDisplayState.UnknownExternalState
  ) {
    return "warning";
  }

  return "muted";
}

export function decisionResultTone(
  result: DecisionRecordResult | string | undefined,
): IsoStatusPillTone {
  if (
    result === DecisionRecordResult.Approved ||
    result === DecisionRecordResult.Executed
  ) {
    return "success";
  }

  if (
    result === DecisionRecordResult.Cancelled ||
    result === DecisionRecordResult.Expired ||
    result === DecisionRecordResult.Failed ||
    result === DecisionRecordResult.Rejected
  ) {
    return "danger";
  }

  return result ? "warning" : "muted";
}

export function executionStatusTone(
  status: AccountabilityExecutionStatus | string | undefined,
): IsoStatusPillTone {
  if (status === AccountabilityExecutionStatus.Completed) {
    return "success";
  }

  if (
    status === AccountabilityExecutionStatus.Blocked ||
    status === AccountabilityExecutionStatus.Failed ||
    status === AccountabilityExecutionStatus.Cancelled
  ) {
    return "danger";
  }

  if (status === AccountabilityExecutionStatus.InProgress) {
    return "warning";
  }

  return status ? "muted" : "muted";
}

export function trustBoundaryMessage(
  disclosure:
    | {
        readonly authorityClaim?: ExternalAuthorityClaim | string;
        readonly note?: string;
        readonly sourceLabel?: ExternalSourceLabel | string;
        readonly trustBoundary?: ExternalTrustBoundary | string;
      }
    | undefined,
): string {
  if (!disclosure) {
    return "This record did not include source disclosure metadata. Treat it as indexed context until the Control Plane supplies a source boundary.";
  }

  if (disclosure.authorityClaim === ExternalAuthorityClaim.ContractAuthoritative) {
    return "Contract/onchain state is authority for Isonia governance state. External and manual material remains evidence, context, or annotation unless explicitly modeled otherwise.";
  }

  if (disclosure.sourceLabel === ExternalSourceLabel.OnchainTransaction) {
    return "This is observed transaction evidence. It shows an onchain transaction record, not a completed business outcome by itself.";
  }

  if (
    disclosure.sourceLabel === ExternalSourceLabel.ManualEvidence ||
    disclosure.trustBoundary === ExternalTrustBoundary.ManualContext
  ) {
    return "Manual updates are annotations. They can explain follow-through, but they are not protocol truth.";
  }

  if (disclosure.trustBoundary === ExternalTrustBoundary.ImportPreview) {
    return "This import preview is displayed for review as evidence/context only. App Core does not treat it as governance authority.";
  }

  if (disclosure.trustBoundary === ExternalTrustBoundary.UnverifiedLink) {
    return "This unverified link is displayed as context only. App Core does not verify or import provider state directly.";
  }

  if (disclosure.trustBoundary === ExternalTrustBoundary.ExternalPlatformRecord) {
    return "This external platform record is evidence/context unless the backend has explicitly modeled the external field as authoritative.";
  }

  return "This record is evidence/context unless its source disclosure explicitly marks the contract as authoritative for Isonia governance state.";
}

export function isNotFoundApiError(error: Error | undefined): boolean {
  return error instanceof IsoniaApiError && error.status === 404;
}
