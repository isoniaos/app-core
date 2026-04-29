import { Link } from "react-router-dom";
import { useDiagnostics } from "./DiagnosticsProvider";
import { getDiagnosticsStatusSummary } from "./diagnostics-status";

export function DiagnosticsStatusIndicator(): JSX.Element {
  const diagnostics = useDiagnostics();
  const summary = getDiagnosticsStatusSummary(diagnostics);

  return (
    <Link
      aria-label={`System status: ${summary.label}. ${summary.detail}. Open diagnostics.`}
      className={`system-status system-status-${summary.kind}`}
      to="/diagnostics"
      title={summary.detail}
    >
      <span className="system-status-dot" aria-hidden="true" />
      <span className="system-status-label">{summary.label}</span>
      <span className="system-status-detail">{summary.detail}</span>
    </Link>
  );
}
