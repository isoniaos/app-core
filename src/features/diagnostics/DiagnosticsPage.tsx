import type {
  ActivationCapabilityStatus,
  ActivationExecutionMode,
  DiagnosticsContractCursorDto,
  DiagnosticsContractDto,
  DiagnosticsDto,
  DiagnosticsProjectionErrorDto,
  DiagnosticsStaleDataIndicatorDto,
} from "@isonia/types";
import {
  isContractBatchActivationMode,
  isSerialActivationMode,
  isWalletBatchEip5792Mode,
} from "@isonia/sdk";
import { useSearchParams } from "react-router-dom";
import {
  useActivationCapabilities,
  type ActivationCapabilitiesQuery,
} from "../../api/useActivationCapabilities";
import { useOrganizationFinalization } from "../../api/useOrganizationFinalization";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
  formatNumericString,
} from "../../utils/format";
import { useWalletSetup } from "../../wallet/WalletProvider";
import { useWalletConnection } from "../../wallet/useWalletConnection";
import { useDiagnostics } from "./DiagnosticsProvider";
import {
  getDiagnosticsSeverityTone,
  getDiagnosticsStatusSummary,
} from "./diagnostics-status";

type DiagnosticsPageVariant = "home" | "diagnostics";

interface DiagnosticsProtocolFinalization {
  readonly emergencyRecoverySupported?: boolean;
  readonly eventDecodingSupported?: boolean;
  readonly eventName?: string;
  readonly governanceControlledPostFinalizationMutationSupported?: boolean;
  readonly latestProjectionError?: DiagnosticsProjectionErrorDto;
  readonly projectedEventCount?: number;
  readonly rawEventCount?: number;
  readonly status?: string;
}

interface DiagnosticsWithProtocol extends DiagnosticsDto {
  readonly protocol?: {
    readonly evmContractsVersion?: string;
    readonly finalization?: DiagnosticsProtocolFinalization;
  };
}

export function DiagnosticsHomePage(): JSX.Element {
  return <DiagnosticsPageContent variant="home" />;
}

export function DiagnosticsPage(): JSX.Element {
  return <DiagnosticsPageContent variant="diagnostics" />;
}

function DiagnosticsPageContent({
  variant,
}: {
  readonly variant: DiagnosticsPageVariant;
}): JSX.Element {
  const [searchParams] = useSearchParams();
  const runtimeConfig = useRuntimeConfig();
  const diagnostics = useDiagnostics();
  const activationCapabilities = useActivationCapabilities();
  const walletSetup = useWalletSetup();
  const walletConnection = useWalletConnection();
  const isHome = variant === "home";
  const orgId = normalizeOptionalOrgId(searchParams.get("orgId"));

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={isHome ? "v0.6 local demo" : "Control Plane"}
        title={isHome ? "IsoniaOS local demo status" : "Diagnostics"}
        description={
          isHome
            ? "Check API, indexer, projections, wallet, runtime config, and chain connectivity before running setup or proposal flows."
            : "Operator view for API availability, chain indexing, projection health, stale data, wallet state, and runtime configuration."
        }
      />

      <DiagnosticsSupportGuidance />

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

      <DiagnosticsActivationCapabilities capabilities={activationCapabilities} />

      <DiagnosticsOrganizationFinalization orgId={orgId} />

      <DiagnosticsLocalRuntime
        runtimeConfig={runtimeConfig}
        walletConnection={walletConnection}
        walletSetup={walletSetup}
      />
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
  const protocolFinalization =
    (diagnostics as DiagnosticsWithProtocol).protocol?.finalization;

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
        title="Protocol Finalization"
        subtitle="Control Plane diagnostics for OrganizationFinalized decoding and projection support."
      >
        {protocolFinalization ? (
          <DetailList
            items={[
              ["Status", protocolFinalization.status ?? "Not reported"],
              [
                "Event decoding",
                protocolFinalization.eventDecodingSupported ? "Supported" : "No",
                protocolFinalization.eventDecodingSupported
                  ? "success"
                  : "warning",
              ],
              [
                "Event",
                protocolFinalization.eventName ?? "OrganizationFinalized",
              ],
              [
                "Raw finalization events",
                formatOptionalCount(protocolFinalization.rawEventCount),
              ],
              [
                "Projected finalization events",
                formatOptionalCount(protocolFinalization.projectedEventCount),
              ],
              [
                "Emergency recovery",
                protocolFinalization.emergencyRecoverySupported
                  ? "Supported"
                  : "Not implemented",
                protocolFinalization.emergencyRecoverySupported
                  ? "warning"
                  : "muted",
              ],
              [
                "Governance-controlled post-finalization changes",
                protocolFinalization.governanceControlledPostFinalizationMutationSupported
                  ? "Supported"
                  : "Not implemented",
                protocolFinalization.governanceControlledPostFinalizationMutationSupported
                  ? "warning"
                  : "muted",
              ],
            ]}
          />
        ) : (
          <DiagnosticsInlineState
            title="Finalization diagnostics not reported"
            message="This Control Plane diagnostics response did not include protocol finalization metadata."
          />
        )}
      </DiagnosticsPanel>

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

function DiagnosticsActivationCapabilities({
  capabilities,
}: {
  readonly capabilities: ActivationCapabilitiesQuery;
}): JSX.Element {
  const activation = capabilities.activation;
  const finalization = capabilities.data?.finalization;

  return (
    <>
      <DiagnosticsPanel
        title="Activation Capabilities"
        subtitle="Control Plane capability metadata for setup activation modes."
      >
        {capabilities.loading && !activation ? (
          <DiagnosticsInlineState
            title="Loading activation capabilities"
            message="Reading /v1/capabilities from Control Plane."
          />
        ) : null}

        {capabilities.error ? (
          <div className="diagnostics-indicator diagnostics-indicator-warning">
            <div className="diagnostics-indicator-header">
              <div>
                <strong>Capabilities unavailable</strong>
                <span>
                  Capability metadata unavailable; setup activation uses serial
                  fallback.
                </span>
              </div>
              <StatusBadge tone="warning">Fallback</StatusBadge>
            </div>
            <p>{sanitizeDiagnosticText(capabilities.error.message)}</p>
            <button
              className="button button-small"
              type="button"
              onClick={capabilities.reload}
            >
              Retry
            </button>
          </div>
        ) : null}

        {activation ? (
          <DetailList
            items={[
              ["API version", capabilities.data?.apiVersion ?? "Not reported"],
              [
                "Capability chain",
                capabilities.data?.chainId === undefined
                  ? "Not reported"
                  : String(capabilities.data.chainId),
              ],
              ["Generated", formatDateTime(capabilities.data?.generatedAt)],
              [
                "Available modes",
                formatActivationModes(activation.availableModes),
              ],
              [
                "Selected default",
                capabilities.contractBatchSupported
                  ? "Contract batch"
                  : "Serial",
                capabilities.contractBatchSupported ? "success" : "muted",
              ],
              [
                "Serial fallback",
                capabilities.serialFallbackAvailable ? "Available" : "Missing",
                capabilities.serialFallbackAvailable ? "success" : "danger",
              ],
            ]}
          />
        ) : null}
      </DiagnosticsPanel>

      {activation ? (
        <div className="two-column-grid">
          <DiagnosticsPanel
            title="Contract Batch"
            subtitle="Typed GovCore batch activation support reported by Control Plane."
          >
            <DetailList
              items={[
                [
                  "Status",
                  formatLabel(activation.contractBatch.status),
                  getCapabilityStatusTone(activation.contractBatch.status),
                ],
                [
                  "Flag",
                  activation.flags.contractBatch ? "Enabled" : "Disabled",
                  activation.flags.contractBatch ? "success" : "muted",
                ],
                [
                  "All admin functions",
                  capabilities.contractBatchAvailableForAllAdminFunctions
                    ? "Supported"
                    : "Not fully supported",
                  capabilities.contractBatchAvailableForAllAdminFunctions
                    ? "success"
                    : "warning",
                ],
                [
                  "Functions",
                  formatFunctionNames(
                    activation.contractBatch.supportedFunctions,
                  ),
                ],
              ]}
            />
          </DiagnosticsPanel>

          <DiagnosticsPanel
            title="Wallet Batch"
            subtitle="EIP-5792 remains non-primary and feature-gated."
          >
            <DetailList
              items={[
                [
                  "Status",
                  formatLabel(
                    activation.walletBatchEip5792?.status ?? "unknown",
                  ),
                  getCapabilityStatusTone(
                    activation.walletBatchEip5792?.status ?? "unknown",
                  ),
                ],
                [
                  "Available mode",
                  capabilities.eip5792AvailableMode ? "Yes" : "No",
                  capabilities.eip5792AvailableMode ? "warning" : "muted",
                ],
                ["Default path", "No", "success"],
                [
                  "Standard",
                  activation.walletBatchEip5792?.standard ?? "eip5792",
                ],
              ]}
            />
          </DiagnosticsPanel>
        </div>
      ) : null}

      <DiagnosticsPanel
        title="Finalization Capabilities"
        subtitle="Control Plane capability metadata for bootstrap finalization."
      >
        {capabilities.loading && !finalization ? (
          <DiagnosticsInlineState
            title="Loading finalization capabilities"
            message="Reading finalization capability metadata from /v1/capabilities."
          />
        ) : null}

        {capabilities.error ? (
          <DiagnosticsInlineState
            title="Finalization capabilities unavailable"
            message="Capability metadata is unavailable; App Core keeps finalization disabled until status is confirmed."
          />
        ) : null}

        {finalization ? (
          <DetailList
            items={[
              [
                "Organization finalization",
                formatLabel(finalization.organization.status),
                getFinalizationCapabilityTone(
                  finalization.organization.status,
                ),
              ],
              [
                "Functions",
                formatFunctionNames(
                  finalization.organization.supportedFunctions,
                ),
              ],
              [
                "Emergency recovery",
                formatLabel(finalization.emergencyRecovery.status),
                "muted",
              ],
              [
                "Governance-controlled changes",
                formatLabel(
                  finalization.governanceControlledPostFinalizationMutation
                    .status,
                ),
                "muted",
              ],
            ]}
          />
        ) : null}
      </DiagnosticsPanel>
    </>
  );
}

function DiagnosticsOrganizationFinalization({
  orgId,
}: {
  readonly orgId: string | undefined;
}): JSX.Element {
  if (!orgId) {
    return (
      <DiagnosticsPanel
        title="Organization Finalization"
        subtitle="Per-organization finalization status from Control Plane."
      >
        <DiagnosticsInlineState
          title="No organization context"
          message="Open diagnostics with ?orgId=<id> to inspect a specific organization's finalization read model."
        />
      </DiagnosticsPanel>
    );
  }

  return <DiagnosticsOrganizationFinalizationRead orgId={orgId} />;
}

function DiagnosticsOrganizationFinalizationRead({
  orgId,
}: {
  readonly orgId: string;
}): JSX.Element {
  const finalization = useOrganizationFinalization(orgId);

  return (
    <DiagnosticsPanel
      title="Organization Finalization"
      subtitle={`Finalization read model for org #${orgId}.`}
    >
      {finalization.loading && !finalization.data ? (
        <DiagnosticsInlineState
          title="Loading finalization status"
          message="Reading organization finalization metadata from Control Plane."
        />
      ) : null}

      {finalization.error ? (
        <div className="diagnostics-indicator diagnostics-indicator-warning">
          <div className="diagnostics-indicator-header">
            <div>
              <strong>Finalization endpoint unavailable</strong>
              <span>{finalization.statusCopy}</span>
            </div>
            <StatusBadge tone="warning">Unavailable</StatusBadge>
          </div>
          <p>{sanitizeDiagnosticText(finalization.error.message)}</p>
          <button
            className="button button-small"
            type="button"
            onClick={finalization.reload}
          >
            Retry
          </button>
        </div>
      ) : null}

      {finalization.data ? (
        <DetailList
          items={[
            ["Endpoint", finalization.endpointReachable ? "Reachable" : "Unknown"],
            [
              "Status",
              finalization.statusLabel,
              finalization.finalized
                ? "success"
                : finalization.notFinalized
                  ? "warning"
                  : "muted",
            ],
            ["Lifecycle", formatLabel(finalization.data.lifecycleStatus)],
            [
              "Bootstrap admin mutations",
              finalization.data.bootstrapAdminMutationsAllowed === null
                ? "Unknown"
                : finalization.data.bootstrapAdminMutationsAllowed
                  ? "Available"
                  : "Closed",
              finalization.data.bootstrapAdminMutationsAllowed === false
                ? "success"
                : "muted",
            ],
            [
              "Blocked operations",
              finalization.data.blockedBootstrapAdminOperations.length.toLocaleString(),
            ],
            [
              "Finalized by",
              finalization.data.finalizedBy
                ? formatAddress(finalization.data.finalizedBy)
                : "Not finalized",
            ],
            [
              "Finalized tx",
              finalization.data.finalizedTxHash
                ? formatAddress(finalization.data.finalizedTxHash)
                : "Not finalized",
            ],
            ["Finalized block", finalization.data.finalizedBlock ?? "Not finalized"],
            ["Finalized at", formatChainTime(finalization.data.finalizedAt)],
          ]}
        />
      ) : null}
    </DiagnosticsPanel>
  );
}

function DiagnosticsSupportGuidance(): JSX.Element {
  return (
    <section className="panel diagnostics-panel">
      <div className="panel-header">
        <div>
          <h2>When to use this page</h2>
          <p className="panel-subtitle">
            Local demo support surface for stale UI state and setup/proposal
            flow troubleshooting.
          </p>
        </div>
      </div>
      <div className="diagnostics-panel-body">
        <ul className="diagnostics-guidance-list">
          <li>
            Use this page when transactions are mined but not reflected in the UI.
          </li>
          <li>
            Check Control Plane, indexer, projections, runtime config, wallet,
            and chain connectivity when local state looks stale.
          </li>
          <li>
            For local Hardhat restarts, confirm contract addresses and runtime
            config before retrying setup or proposal flows.
          </li>
        </ul>
      </div>
    </section>
  );
}

function DiagnosticsLocalRuntime({
  runtimeConfig,
  walletConnection,
  walletSetup,
}: {
  readonly runtimeConfig: ReturnType<typeof useRuntimeConfig>;
  readonly walletConnection: ReturnType<typeof useWalletConnection>;
  readonly walletSetup: ReturnType<typeof useWalletSetup>;
}): JSX.Element {
  const walletTone = walletConnection.isConnected ? "success" : "muted";
  const chainTone =
    walletConnection.chainId === undefined ||
    walletConnection.chainId === runtimeConfig.chainId
      ? "success"
      : "danger";

  return (
    <div className="two-column-grid">
      <DiagnosticsPanel
        title="Runtime Config"
        subtitle="Local app configuration loaded before App Core starts."
      >
        <DetailList
          items={[
            ["Mode", formatLabel(runtimeConfig.mode)],
            ["API base URL", runtimeConfig.apiBaseUrl],
            ["RPC URL", runtimeConfig.rpcUrl],
            [
              "Configured chain",
              `${runtimeConfig.chainName} (${runtimeConfig.chainId})`,
            ],
            [
              "Reown AppKit",
              walletSetup.appKitEnabled ? "Enabled" : "Injected fallback",
              walletSetup.appKitEnabled ? "success" : "warning",
            ],
            [
              "Wallet account mode",
              walletSetup.accountMode === "eoa_only_appkit"
                ? "EOA-only AppKit"
                : "Injected fallback",
              walletSetup.accountMode === "eoa_only_appkit" ? "success" : "muted",
            ],
            [
              "Create proposal",
              runtimeConfig.features.createProposal ? "Enabled" : "Disabled",
              runtimeConfig.features.createProposal ? "success" : "muted",
            ],
            [
              "EIP-5792 batch",
              runtimeConfig.features.eip5792Batch ? "Enabled" : "Disabled",
              runtimeConfig.features.eip5792Batch ? "warning" : "success",
            ],
            [
              "Write actions",
              runtimeConfig.features.writeActions ? "Enabled" : "Disabled",
              runtimeConfig.features.writeActions ? "success" : "muted",
            ],
            ["GovCore", runtimeConfig.contracts.govCoreAddress],
            ["GovProposals", runtimeConfig.contracts.govProposalsAddress],
            [
              "DemoTarget",
              runtimeConfig.contracts.demoTargetAddress ?? "Not configured",
            ],
          ]}
        />
      </DiagnosticsPanel>

      <DiagnosticsPanel
        title="Wallet"
        subtitle="Current browser wallet and chain connection state."
      >
        <DetailList
          items={[
            [
              "Connection",
              walletConnection.isConnected
                ? walletConnection.status
                : "Not connected",
              walletTone,
            ],
            [
              "Wallet chain",
              walletConnection.chainId
                ? String(walletConnection.chainId)
                : "Not reported",
              chainTone,
            ],
            [
              "Expected chain",
              String(runtimeConfig.chainId),
              chainTone,
            ],
            [
              "Connected account",
              walletConnection.address ?? "Not reported",
            ],
            [
              "Connector",
              walletConnection.connector?.name ?? "Not reported",
            ],
            [
              "Wallet setup diagnostics",
              walletSetup.diagnostics.length.toLocaleString(),
              walletSetup.diagnostics.length > 0 ? "warning" : "success",
            ],
          ]}
        />
        {walletSetup.diagnostics.length > 0 ? (
          <div className="diagnostics-indicator-list">
            {walletSetup.diagnostics.map((diagnostic) => (
              <article
                className={`diagnostics-indicator diagnostics-indicator-${
                  diagnostic.level === "error" ? "error" : "warning"
                }`}
                key={diagnostic.code}
              >
                <div className="diagnostics-indicator-header">
                  <div>
                    <strong>{formatLabel(diagnostic.code)}</strong>
                    <span>{diagnostic.message}</span>
                  </div>
                  <StatusBadge
                    tone={diagnostic.level === "error" ? "danger" : "warning"}
                  >
                    {formatLabel(diagnostic.level)}
                  </StatusBadge>
                </div>
                <p>{diagnostic.detail}</p>
              </article>
            ))}
          </div>
        ) : null}
      </DiagnosticsPanel>
    </div>
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

function formatActivationModes(
  modes: readonly ActivationExecutionMode[],
): string {
  if (modes.length === 0) {
    return "None reported";
  }

  return modes.map(formatActivationMode).join(", ");
}

function formatActivationMode(mode: ActivationExecutionMode): string {
  if (isSerialActivationMode(mode)) {
    return "Serial";
  }

  if (isContractBatchActivationMode(mode)) {
    return "Contract batch";
  }

  if (isWalletBatchEip5792Mode(mode)) {
    return "Wallet batch EIP-5792";
  }

  return formatLabel(mode);
}

function formatFunctionNames(functionNames: readonly string[]): string {
  return functionNames.length > 0 ? functionNames.join(", ") : "None reported";
}

function getCapabilityStatusTone(
  status: ActivationCapabilityStatus | "unknown",
): DetailTone {
  switch (status) {
    case "supported":
      return "success";
    case "prototype":
      return "warning";
    case "unsupported":
      return "muted";
    case "unknown":
      return "warning";
  }

  return "warning";
}

function getFinalizationCapabilityTone(status: string): DetailTone {
  switch (status) {
    case "supported":
      return "success";
    case "unsupported":
      return "muted";
    case "unknown":
      return "warning";
    default:
      return "warning";
  }
}

function formatOptionalBlock(value?: string): string {
  return value ? formatNumericString(value) : "Not reported";
}

function formatOptionalCount(value: number | undefined): string {
  return value === undefined ? "Not reported" : value.toLocaleString();
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

function normalizeOptionalOrgId(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
