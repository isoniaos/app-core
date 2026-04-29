import type {
  DiagnosticsDto,
  DiagnosticsIndicatorSeverity,
} from "@isonia/types";

export type DiagnosticsStatusKind =
  | "healthy"
  | "indexing"
  | "warning"
  | "error"
  | "unknown";

export type DiagnosticsTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export interface DiagnosticsStatusSummary {
  readonly kind: DiagnosticsStatusKind;
  readonly label: string;
  readonly detail: string;
  readonly tone: DiagnosticsTone;
}

export function getDiagnosticsStatusSummary({
  data,
  error,
  loading,
}: {
  readonly data: DiagnosticsDto | undefined;
  readonly error: Error | undefined;
  readonly loading: boolean;
}): DiagnosticsStatusSummary {
  if (loading && !data) {
    return {
      kind: "unknown",
      label: "Unknown",
      detail: "Checking diagnostics",
      tone: "muted",
    };
  }

  if (error || !data) {
    return {
      kind: "unknown",
      label: "Unknown",
      detail: "API unavailable",
      tone: "warning",
    };
  }

  const highestSeverity = getHighestSeverity(data);
  const missingContractCount = data.contracts.filter(
    (contract) => !contract.configured,
  ).length;

  if (
    highestSeverity === "error" ||
    data.failedProjectionCount > 0 ||
    data.latestProjectionError ||
    missingContractCount > 0
  ) {
    return {
      kind: "error",
      label: "Error",
      detail: getErrorDetail(data, missingContractCount),
      tone: "danger",
    };
  }

  if (highestSeverity === "warning") {
    return {
      kind: "warning",
      label: "Warning",
      detail: `${data.staleDataIndicators.length} diagnostic indicator${
        data.staleDataIndicators.length === 1 ? "" : "s"
      }`,
      tone: "warning",
    };
  }

  if (highestSeverity === "info" || data.projectionBacklog > 0) {
    return {
      kind: "indexing",
      label: "Indexing",
      detail:
        data.projectionBacklog > 0
          ? `${data.projectionBacklog.toLocaleString()} projection events pending`
          : "Indexer has informational updates",
      tone: "default",
    };
  }

  return {
    kind: "healthy",
    label: "Healthy",
    detail: data.latestSafeBlock
      ? `Safe block ${data.latestSafeBlock}`
      : "No diagnostic warnings",
    tone: "success",
  };
}

export function getDiagnosticsSeverityTone(
  severity: DiagnosticsIndicatorSeverity,
): DiagnosticsTone {
  if (severity === "error") {
    return "danger";
  }

  if (severity === "warning") {
    return "warning";
  }

  return "default";
}

function getHighestSeverity(
  diagnostics: DiagnosticsDto,
): DiagnosticsIndicatorSeverity | undefined {
  if (
    diagnostics.staleDataIndicators.some(
      (indicator) => indicator.severity === "error",
    )
  ) {
    return "error";
  }

  if (
    diagnostics.staleDataIndicators.some(
      (indicator) => indicator.severity === "warning",
    )
  ) {
    return "warning";
  }

  if (diagnostics.staleDataIndicators.length > 0) {
    return "info";
  }

  return undefined;
}

function getErrorDetail(
  diagnostics: DiagnosticsDto,
  missingContractCount: number,
): string {
  if (missingContractCount > 0) {
    return `${missingContractCount} contract address${
      missingContractCount === 1 ? "" : "es"
    } missing`;
  }

  if (diagnostics.failedProjectionCount > 0) {
    return `${diagnostics.failedProjectionCount.toLocaleString()} projection failure${
      diagnostics.failedProjectionCount === 1 ? "" : "s"
    }`;
  }

  if (diagnostics.latestProjectionError) {
    return "Latest projection failed";
  }

  return `${diagnostics.staleDataIndicators.length} error indicator${
    diagnostics.staleDataIndicators.length === 1 ? "" : "s"
  }`;
}
