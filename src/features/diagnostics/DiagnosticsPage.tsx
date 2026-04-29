import type {
  DiagnosticsContractCursorDto,
  DiagnosticsContractDto,
  DiagnosticsDto,
  DiagnosticsProjectionErrorDto,
  DiagnosticsStaleDataIndicatorDto,
} from "@isonia/types";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatLabel,
  formatNumericString,
} from "../../utils/format";
import { useDiagnostics } from "./DiagnosticsProvider";
import {
  getDiagnosticsSeverityTone,
  getDiagnosticsStatusSummary,
} from "./diagnostics-status";

export function DiagnosticsPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const diagnostics = useDiagnostics();

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Control Plane"
        title="Diagnostics"
        description="Operator view for API availability, chain indexing, projection health, stale data, and protocol contract configuration."
      />

      {diagnostics.loading && !diagnostics.data ? (
        <DiagnosticsLoadingState />
      ) : null}

      {diagnostics.error ? (
        <DiagnosticsUnavailableState
          apiBaseUrl={runtimeConfig.apiBaseUrl}
          error={diagnostics.error}
          onRetry={diagnostics.reload}
        />
      ) : null}

      {!diagnostics.loading && !diagnostics.error && !diagnostics.data ? (
        <DiagnosticsEmptyState />
      ) : null}

      {diagnostics.data ? (
        <DiagnosticsDetails diagnostics={diagnostics.data} />
      ) : null}
    </section>
  );
}

function DiagnosticsDetails({
  diagnostics,
}: {
  readonly diagnostics: DiagnosticsDto;
}): JSX.Element {
  const summary = getDiagnosticsStatusSummary({
    data: diagnostics,
    error: undefined,
    loading: false,
  });

  return (
    <>
      <div className="metric-grid">
        <div className="metric">
          <span>System status</span>
          <strong>
            <StatusBadge tone={summary.tone}>{summary.label}</StatusBadge>
          </strong>
        </div>
        <div className="metric">
          <span>Chain</span>
          <strong>{diagnostics.chainId}</strong>
        </div>
        <div className="metric">
          <span>Projection backlog</span>
          <strong>{diagnostics.projectionBacklog.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <span>Projection failures</span>
          <strong>{diagnostics.failedProjectionCount.toLocaleString()}</strong>
        </div>
      </div>

      <div className="two-column-grid">
        <DiagnosticsPanel
          title="API"
          subtitle="Control Plane response metadata. Secrets and internal environment values are not displayed."
        >
          <DetailList
            items={[
              ["API version", diagnostics.apiVersion],
              ["Generated", formatDateTime(diagnostics.generatedAt)],
              ["Status detail", summary.detail],
            ]}
          />
        </DiagnosticsPanel>

        <DiagnosticsPanel
          title="Chain"
          subtitle="Observed chain position and confirmation window."
        >
          <DetailList
            items={[
              ["Configured chain ID", String(diagnostics.chainId)],
              ["Confirmations", diagnostics.confirmations.toLocaleString()],
              [
                "Latest observed block",
                formatOptionalBlock(diagnostics.latestChainBlock),
              ],
              ["Latest safe block", formatOptionalBlock(diagnostics.latestSafeBlock)],
            ]}
          />
        </DiagnosticsPanel>
      </div>

      <DiagnosticsPanel
        title="Contracts"
        subtitle="Configured protocol contracts used by the Control Plane."
      >
        <ContractsTable contracts={diagnostics.contracts} />
      </DiagnosticsPanel>

      <DiagnosticsPanel
        title="Indexer Cursors"
        subtitle="Last scanned and confirmed block per configured contract."
      >
        <CursorTable cursors={diagnostics.lastScannedBlocks} />
      </DiagnosticsPanel>

      <div className="two-column-grid">
        <DiagnosticsPanel
          title="Raw Events"
          subtitle="Durable event store counts by processing state."
        >
          <RawEventCounts diagnostics={diagnostics} />
        </DiagnosticsPanel>

        <DiagnosticsPanel
          title="Projections"
          subtitle="Projection worker backlog and failure state."
        >
          <DetailList
            items={[
              [
                "Backlog",
                diagnostics.projectionBacklog.toLocaleString(),
                diagnostics.projectionBacklog > 0 ? "warning" : "success",
              ],
              [
                "Failed projections",
                diagnostics.failedProjectionCount.toLocaleString(),
                diagnostics.failedProjectionCount > 0 ? "danger" : "success",
              ],
              [
                "Latest error",
                diagnostics.latestProjectionError ? "Present" : "None",
                diagnostics.latestProjectionError ? "danger" : "success",
              ],
            ]}
          />
        </DiagnosticsPanel>
      </div>

      <DiagnosticsPanel
        title="Stale Data Indicators"
        subtitle="Human-readable warnings for indexing, configuration, and freshness issues."
      >
        <StaleIndicators indicators={diagnostics.staleDataIndicators} />
      </DiagnosticsPanel>

      <DiagnosticsPanel
        title="Latest Projection Error"
        subtitle="Most recent failed projection summary when available."
      >
        <LatestProjectionError error={diagnostics.latestProjectionError} />
      </DiagnosticsPanel>
    </>
  );
}

function DiagnosticsPanel({
  children,
  subtitle,
  title,
}: {
  readonly children: React.ReactNode;
  readonly subtitle: string;
  readonly title: string;
}): JSX.Element {
  return (
    <section className="panel diagnostics-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="diagnostics-panel-body">{children}</div>
    </section>
  );
}

type DetailTone = "default" | "success" | "warning" | "danger" | "muted";
type DetailItem = readonly [label: string, value: string, tone?: DetailTone];

function DetailList({
  items,
}: {
  readonly items: readonly DetailItem[];
}): JSX.Element {
  return (
    <dl className="detail-list detail-list-wide diagnostics-detail-list">
      {items.map(([label, value, tone]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {tone ? (
              <StatusBadge tone={tone}>{value}</StatusBadge>
            ) : (
              <span>{value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ContractsTable({
  contracts,
}: {
  readonly contracts: readonly DiagnosticsContractDto[];
}): JSX.Element {
  if (contracts.length === 0) {
    return (
      <DiagnosticsInlineState
        title="No contracts reported"
        message="The diagnostics response did not include configured protocol contracts."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Contract</th>
            <th>Status</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.name}>
              <td>{formatContractName(contract.name)}</td>
              <td>
                <StatusBadge tone={contract.configured ? "success" : "danger"}>
                  {contract.configured ? "Configured" : "Missing"}
                </StatusBadge>
              </td>
              <td className="mono-value">
                {contract.address ? formatAddress(contract.address) : "Not set"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CursorTable({
  cursors,
}: {
  readonly cursors: readonly DiagnosticsContractCursorDto[];
}): JSX.Element {
  if (cursors.length === 0) {
    return (
      <DiagnosticsInlineState
        title="No indexer cursors"
        message="The indexer has not reported per-contract cursor state yet."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Contract</th>
            <th>Last scanned</th>
            <th>Last confirmed</th>
            <th>Lag</th>
            <th>Updated</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {cursors.map((cursor) => (
            <tr key={`${cursor.contractName}:${cursor.address}`}>
              <td>{formatContractName(cursor.contractName)}</td>
              <td>{formatOptionalBlock(cursor.lastScannedBlock)}</td>
              <td>{formatOptionalBlock(cursor.lastConfirmedBlock)}</td>
              <td>{formatOptionalBlock(cursor.lagFromSafeBlock)}</td>
              <td>{formatDateTime(cursor.updatedAt)}</td>
              <td className="mono-value">{formatAddress(cursor.address)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawEventCounts({
  diagnostics,
}: {
  readonly diagnostics: DiagnosticsDto;
}): JSX.Element {
  return (
    <DetailList
      items={[
        ["Observed", diagnostics.rawEventCounts.observed.toLocaleString()],
        ["Confirmed", diagnostics.rawEventCounts.confirmed.toLocaleString()],
        ["Processed", diagnostics.rawEventCounts.processed.toLocaleString()],
        [
          "Failed",
          diagnostics.rawEventCounts.failed.toLocaleString(),
          diagnostics.rawEventCounts.failed > 0 ? "danger" : "success",
        ],
        [
          "Orphaned",
          diagnostics.rawEventCounts.orphaned.toLocaleString(),
          diagnostics.rawEventCounts.orphaned > 0 ? "warning" : "success",
        ],
      ]}
    />
  );
}

function StaleIndicators({
  indicators,
}: {
  readonly indicators: readonly DiagnosticsStaleDataIndicatorDto[];
}): JSX.Element {
  if (indicators.length === 0) {
    return (
      <DiagnosticsInlineState
        title="No stale data indicators"
        message="The Control Plane did not report stale data, indexer lag, or configuration warnings."
      />
    );
  }

  return (
    <div className="diagnostics-indicator-list">
      {indicators.map((indicator) => (
        <article
          className={`diagnostics-indicator diagnostics-indicator-${indicator.severity}`}
          key={getIndicatorKey(indicator)}
        >
          <div className="diagnostics-indicator-header">
            <div>
              <strong>{formatLabel(indicator.code)}</strong>
              <span>{sanitizeDiagnosticText(indicator.message)}</span>
            </div>
            <StatusBadge tone={getDiagnosticsSeverityTone(indicator.severity)}>
              {formatLabel(indicator.severity)}
            </StatusBadge>
          </div>
          <dl className="detail-list diagnostics-indicator-details">
            <OptionalDetail
              label="Contract"
              value={
                indicator.contractName
                  ? formatContractName(indicator.contractName)
                  : undefined
              }
            />
            <OptionalDetail
              label="Address"
              mono
              value={
                indicator.contractAddress
                  ? formatAddress(indicator.contractAddress)
                  : undefined
              }
            />
            <OptionalDetail
              label="Last scanned"
              value={indicator.lastScannedBlock}
            />
            <OptionalDetail
              label="Latest safe"
              value={indicator.latestSafeBlock}
            />
            <OptionalDetail label="Lag" value={indicator.lagBlocks} />
          </dl>
        </article>
      ))}
    </div>
  );
}

function LatestProjectionError({
  error,
}: {
  readonly error: DiagnosticsProjectionErrorDto | undefined;
}): JSX.Element {
  if (!error) {
    return (
      <DiagnosticsInlineState
        title="No projection errors"
        message="The projection worker has not reported a latest failure."
      />
    );
  }

  return (
    <div className="diagnostics-error-summary">
      <div className="blocked-reason blocked-reason-danger">
        <div className="blocked-reason-header">
          <strong>{formatLabel(error.eventName)}</strong>
          <StatusBadge tone="danger">
            {error.processingAttempts.toLocaleString()} attempt
            {error.processingAttempts === 1 ? "" : "s"}
          </StatusBadge>
        </div>
        <span>{sanitizeDiagnosticText(error.error)}</span>
        <small>
          Raw event #{error.rawEventId} failed{" "}
          {error.failedAt ? formatDateTime(error.failedAt) : "at an unknown time"}
        </small>
      </div>

      <DetailList
        items={[
          ["Chain ID", String(error.chainId)],
          ["Block", formatNumericString(error.blockNumber)],
          ["Log index", error.logIndex.toLocaleString()],
          ["Contract", formatAddress(error.contractAddress)],
          ["Transaction", formatAddress(error.txHash)],
        ]}
      />
    </div>
  );
}

function OptionalDetail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string | undefined;
}): JSX.Element | null {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono-value" : undefined}>{value}</dd>
    </div>
  );
}

function DiagnosticsInlineState({
  message,
  title,
}: {
  readonly message: string;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="diagnostics-inline-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function DiagnosticsLoadingState(): JSX.Element {
  return (
    <div className="state-panel" role="status">
      <span className="loading-bar" />
      <strong>Loading diagnostics</strong>
      <p>Reading Control Plane diagnostics from the SDK.</p>
    </div>
  );
}

function DiagnosticsUnavailableState({
  apiBaseUrl,
  error,
  onRetry,
}: {
  readonly apiBaseUrl: string;
  readonly error: Error;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <div className="state-panel state-panel-error">
      <strong>Diagnostics unavailable</strong>
      <p>
        API unreachable at {apiBaseUrl}. Check the Control Plane process, CORS,
        and runtime config.
      </p>
      <p>{sanitizeDiagnosticText(error.message)}</p>
      <button className="button" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function DiagnosticsEmptyState(): JSX.Element {
  return (
    <div className="state-panel">
      <strong>Diagnostics unavailable</strong>
      <p>The diagnostics endpoint returned no data.</p>
    </div>
  );
}

function formatContractName(name: string): string {
  if (name === "govCore") {
    return "GovCore";
  }

  if (name === "govProposals") {
    return "GovProposals";
  }

  return formatLabel(name);
}

function formatOptionalBlock(value?: string): string {
  return value ? formatNumericString(value) : "Not reported";
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not reported";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(
      /:\/\/([^:/\s]+):([^@\s]+)@/g,
      "://[redacted-credentials]@",
    )
    .replace(
      /\b(password|secret|token|api[_-]?key|private[_-]?key)=([^\s&]+)/gi,
      "$1=[redacted]",
    )
    .slice(0, 700);
}

function getIndicatorKey(indicator: DiagnosticsStaleDataIndicatorDto): string {
  return [
    indicator.code,
    indicator.severity,
    indicator.contractName ?? "all",
    indicator.contractAddress ?? "none",
    indicator.lastScannedBlock ?? "none",
    indicator.latestSafeBlock ?? "none",
    indicator.lagBlocks ?? "none",
  ].join(":");
}
