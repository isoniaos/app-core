import type {
  BodyDto,
  GovernanceGraphDto,
  MandateDto,
  OrganizationPoliciesDto,
  OrganizationPolicyDto,
  RoleDto,
} from "@isonia/types";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import {
  IsoAddressDisplay,
  IsoIcon,
  IsoSegmentedControl,
  IsoTabs,
  IsoToggleTip,
  type IsoTabItem,
} from "../../ui-kit";
import { bodyDisplay, roleDisplay } from "../../utils/display-labels";
import { formatLabel } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { GovernanceStructureGraph } from "./GovernanceStructureGraph";
import {
  buildGovernanceStructureModel,
  formatDurationSeconds,
  getMandateState,
  getProposalScopeLabel,
  sortByNumeric,
  sortPolicies,
  type GovernanceMetric,
  type GovernanceStructureData,
  type GovernanceStructureModel,
  type GovernanceStructureNode,
  type StructureNodeDetail,
} from "./governance-structure-model";

const GOVERNANCE_ABOUT_TITLE = "Authority on-chain, visualization off-chain";
const GOVERNANCE_ABOUT_TEXT =
  "This page uses indexed Control Plane read models to show bodies, roles, holder mandates, and policy route references. Conceptual checks are labeled as modeled or unverified rather than treated as production health scores.";

export function GovernanceStructurePage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const [activeTab, setActiveTab] = useState("graph");
  const [fitSignal, setFitSignal] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const governance = useIsoniaQuery(
    async (): Promise<GovernanceStructureData> => {
      const [overview, bodies, roles, mandates, policiesResult, graphResult] =
        await Promise.all([
          client.getOrganizationOverview(orgId),
          client.getBodies(orgId),
          client.getRoles(orgId),
          client.getMandates(orgId),
          loadOptional<OrganizationPoliciesDto>(() => client.policies.list(orgId)),
          loadOptional<GovernanceGraphDto>(() => client.getGraph(orgId)),
        ]);

      return {
        bodies,
        graph: graphResult.data,
        graphError: graphResult.error,
        mandates,
        overview,
        policies: policiesResult.data ?? [],
        policiesError: policiesResult.error,
        roles,
      };
    },
    [client, orgId],
  );

  return (
    <section className="page-stack governance-structure-page">
      <header className="governance-structure-header">
        <div>
          <p className="eyebrow">Org #{orgId}</p>
          <h1>Governance Structure</h1>
          <p>Explore how authority flows through this organization.</p>
        </div>
        <div className="governance-structure-header-actions">
          <IsoToggleTip
            content={GOVERNANCE_ABOUT_TEXT}
            title={GOVERNANCE_ABOUT_TITLE}
          >
            <button
              aria-label="About this view"
              className="button button-icon button-borderless governance-structure-about-trigger"
              type="button"
            >
              <IsoIcon name="info" size={18} />
            </button>
          </IsoToggleTip>
        </div>
      </header>

      <AsyncContent
        state={governance}
        loadingTitle="Loading governance structure"
        loadingMessage="Reading organization, body, role, mandate, policy, and graph read models."
        emptyTitle="No organization found"
        emptyMessage={`No indexed organization was found for org #${orgId}.`}
        errorTitle="Unable to load governance structure"
      >
        {(data) => (
          <GovernanceStructureContent
            activeTab={activeTab}
            data={data}
            fitSignal={fitSignal}
            orgId={orgId}
            selectedNodeId={selectedNodeId}
            showInactive={showInactive}
            onActiveTabChange={setActiveTab}
            onFit={() => setFitSignal((value) => value + 1)}
            onSelectedNodeChange={setSelectedNodeId}
            onShowInactiveChange={setShowInactive}
          />
        )}
      </AsyncContent>
    </section>
  );
}

function GovernanceStructureContent({
  activeTab,
  data,
  fitSignal,
  onActiveTabChange,
  onFit,
  onSelectedNodeChange,
  onShowInactiveChange,
  orgId,
  selectedNodeId,
  showInactive,
}: {
  readonly activeTab: string;
  readonly data: GovernanceStructureData;
  readonly fitSignal: number;
  readonly onActiveTabChange: (value: string) => void;
  readonly onFit: () => void;
  readonly onSelectedNodeChange: (nodeId: string | undefined) => void;
  readonly onShowInactiveChange: (showInactive: boolean) => void;
  readonly orgId: string;
  readonly selectedNodeId: string | undefined;
  readonly showInactive: boolean;
}): JSX.Element {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const model = useMemo(
    () => buildGovernanceStructureModel({ data, nowSeconds }),
    [data, nowSeconds],
  );
  const graphNodes = useMemo(
    () =>
      showInactive
        ? model.nodes
        : model.nodes.filter((node) => isNodeVisibleWhenActive(node)),
    [model.nodes, showInactive],
  );
  const visibleNodeIds = useMemo(
    () => new Set(graphNodes.map((node) => node.id)),
    [graphNodes],
  );
  const graphEdges = useMemo(
    () =>
      model.edges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [model.edges, visibleNodeIds],
  );
  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId);
  const hasActivationGaps = model.health.label !== "Modeled";
  const tabs = getTabs({
    data,
    model,
    nowSeconds,
    activeTab,
    onActiveTabChange,
    orgId,
    graphContent: (
      <GovernanceStructureGraphTab
        activePolicyCount={model.activePolicyCount}
        data={data}
        edges={graphEdges}
        fitSignal={fitSignal}
        hasInactiveData={model.hasInactiveData}
        nodes={graphNodes}
        orgId={orgId}
        selectedNode={selectedNode}
        selectedNodeId={selectedNodeId}
        showInactive={showInactive}
        onFit={onFit}
        onViewModeChange={onActiveTabChange}
        viewMode={activeTab === "bodies" ? "bodies" : "graph"}
        onSelectedNodeChange={onSelectedNodeChange}
        onShowInactiveChange={onShowInactiveChange}
      />
    ),
  });
  const wrappedTabs = tabs.map((tab) => ({
    ...tab,
    content: (
      <GovernanceStructureTabFrame
        hasActivationGaps={hasActivationGaps}
        metrics={model.metrics}
        model={model}
        orgId={orgId}
        selectedNode={selectedNode}
      >
        {tab.content}
      </GovernanceStructureTabFrame>
    ),
  }));

  return (
    <IsoTabs
      ariaLabel="Governance structure sections"
      className="governance-structure-tabs"
      tabs={wrappedTabs}
      value={activeTab}
      onValueChange={onActiveTabChange}
    />
  );
}

function GovernanceStructureTabFrame({
  children,
  hasActivationGaps,
  metrics,
  model,
  orgId,
  selectedNode,
}: {
  readonly children: ReactNode;
  readonly hasActivationGaps: boolean;
  readonly metrics: readonly GovernanceMetric[];
  readonly model: GovernanceStructureModel;
  readonly orgId: string;
  readonly selectedNode: GovernanceStructureNode | undefined;
}): JSX.Element {
  return (
    <div className="governance-structure-tab-frame">
      <MetricRow metrics={metrics} />

      {hasActivationGaps ? (
        <div className="inline-state inline-state-muted governance-structure-activation">
          <strong>Activation incomplete</strong>
          <span>
            Some authority read models are missing or partial. Continue
            activation to index bodies, roles, mandates, and policy routes.
          </span>
          <Link className="diagnostics-text-link" to={`/orgs/${orgId}/setup`}>
            Continue activation
          </Link>
        </div>
      ) : null}

      <div className="governance-structure-layout">
        <main>{children}</main>
        <GovernanceStructureAside
          model={model}
          orgId={orgId}
          selectedNode={selectedNode}
        />
      </div>
    </div>
  );
}

function GovernanceStructureGraphTab({
  activePolicyCount,
  data,
  edges,
  fitSignal,
  hasInactiveData,
  nodes,
  onFit,
  onSelectedNodeChange,
  onShowInactiveChange,
  onViewModeChange,
  orgId,
  selectedNode,
  selectedNodeId,
  showInactive,
  viewMode,
}: {
  readonly activePolicyCount: number;
  readonly data: GovernanceStructureData;
  readonly edges: readonly GovernanceStructureModel["edges"][number][];
  readonly fitSignal: number;
  readonly hasInactiveData: boolean;
  readonly nodes: readonly GovernanceStructureNode[];
  readonly onFit: () => void;
  readonly onSelectedNodeChange: (nodeId: string | undefined) => void;
  readonly onShowInactiveChange: (showInactive: boolean) => void;
  readonly onViewModeChange: (value: string) => void;
  readonly orgId: string;
  readonly selectedNode: GovernanceStructureNode | undefined;
  readonly selectedNodeId: string | undefined;
  readonly showInactive: boolean;
  readonly viewMode: "graph" | "bodies";
}): JSX.Element {
  return (
    <section className="panel governance-graph-panel">
      <div className="panel-header governance-graph-header">
        <div>
          <h2>Authority Graph</h2>
          <p className="panel-subtitle">
            Visualize governance bodies, roles, mandates, and policy route
            relationships.
          </p>
        </div>
        <div className="governance-graph-controls">
          <GovernanceGraphListSwitch
            value={viewMode}
            onValueChange={onViewModeChange}
          />
          {hasInactiveData ? (
            <label className="governance-structure-switch">
              <input
                checked={showInactive}
                type="checkbox"
                onChange={(event) => onShowInactiveChange(event.target.checked)}
              />
              <span>Show inactive</span>
            </label>
          ) : null}
        </div>
      </div>

      {nodes.length === 0 ? (
        <GraphEmptyState orgId={orgId} />
      ) : (
        <div className="governance-flow-shell">
          <GovernanceStructureGraph
            edges={edges}
            fitSignal={fitSignal}
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectedNodeChange={onSelectedNodeChange}
          />
        </div>
      )}

      <div className="governance-graph-footer">
        <GraphLegend />
        <div className="governance-graph-indexed-state">
          {data.graphError ? (
            <StatusBadge tone="warning">Indexed graph needs data</StatusBadge>
          ) : (
            <StatusBadge tone={data.graph ? "success" : "warning"}>
              {data.graph ? "Indexed graph loaded" : "Indexed graph unavailable"}
            </StatusBadge>
          )}
          <StatusBadge tone={activePolicyCount ? "success" : "warning"}>
            {activePolicyCount} active policy routes
          </StatusBadge>
        </div>
      </div>

      {selectedNode ? (
        <SelectedNodeInlineSummary node={selectedNode} />
      ) : null}
    </section>
  );
}

function MetricRow({
  metrics,
}: {
  readonly metrics: readonly GovernanceMetric[];
}): JSX.Element {
  return (
    <div className="metric-grid governance-structure-metric-grid">
      {metrics.map((metric) => (
        <div className="metric governance-structure-metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small className={`governance-structure-metric-meta metric-${metric.tone}`}>
            {metric.meta}
          </small>
        </div>
      ))}
    </div>
  );
}

function GovernanceStructureAside({
  model,
  orgId,
  selectedNode,
}: {
  readonly model: GovernanceStructureModel;
  readonly orgId: string;
  readonly selectedNode: GovernanceStructureNode | undefined;
}): JSX.Element {
  return (
    <aside className="governance-structure-aside">
      <section className="panel">
        <div className="panel-header">
          <h2>Structure Overview</h2>
        </div>
        <DetailList details={model.structureOverview} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Authority Flow</h2>
        </div>
        <div className="governance-check-list">
          {model.authorityChecks.map((check) => (
            <div className="governance-check-row" key={check.label}>
              <span>{check.label}</span>
              <StatusBadge tone={check.tone}>{check.status}</StatusBadge>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Selected Node</h2>
        </div>
        {selectedNode ? (
          <SelectedNodeDetails node={selectedNode} />
        ) : (
          <div className="inline-state inline-state-muted governance-selected-empty">
            <strong>No node selected</strong>
            <span>Select a graph node to inspect its indexed details.</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="governance-quick-actions">
          <Link className="button" to={`/orgs/${orgId}/setup`}>
            Setup / Activation
          </Link>
          <Link className="button" to={`/orgs/${orgId}/proposals`}>
            Proposals
          </Link>
          <Link className="button" to={`/orgs/${orgId}/governance`}>
            Governance Structure
          </Link>
        </div>
      </section>
    </aside>
  );
}

function BodiesTab({
  activeTab,
  bodies,
  mandates,
  onActiveTabChange,
  roles,
}: {
  readonly activeTab: string;
  readonly bodies: readonly BodyDto[];
  readonly mandates: readonly MandateDto[];
  readonly onActiveTabChange: (value: string) => void;
  readonly roles: readonly RoleDto[];
}): JSX.Element {
  if (bodies.length === 0) {
    return (
      <EmptySection
        message="No governance bodies are indexed for this organization yet."
        title="No bodies indexed"
      />
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Bodies</h2>
          <p className="panel-subtitle">Total {bodies.length} bodies</p>
        </div>
        <GovernanceGraphListSwitch
          value={activeTab === "bodies" ? "bodies" : "graph"}
          onValueChange={onActiveTabChange}
        />
      </div>
      <div className="card-grid governance-card-grid">
        {sortByNumeric(bodies, (body) => body.bodyId).map((body) => {
          const display = bodyDisplay(body, body.bodyId, undefined);
          const relatedRoles = roles.filter((role) => role.bodyId === body.bodyId);
          const relatedMandates = mandates.filter(
            (mandate) => mandate.bodyId === body.bodyId,
          );
          return (
            <article className="entity-card" key={body.bodyId}>
              <div className="entity-card-header">
                <div>
                  <h3>{display.title}</h3>
                  <p>{display.subtitle}</p>
                </div>
                <StatusBadge tone={body.active ? "success" : "muted"}>
                  {body.active ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
              <dl className="detail-list">
                <Detail label="Kind" value={formatLabel(body.kind)} />
                <Detail label="Roles" value={String(relatedRoles.length)} />
                <Detail label="Mandates" value={String(relatedMandates.length)} />
                <Detail label="Created block" value={body.createdBlock} />
                <div>
                  <dt>Data status</dt>
                  <dd>
                    <DataStatusBadge status={body.dataStatus} />
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RolesTab({
  mandates,
  roles,
}: {
  readonly mandates: readonly MandateDto[];
  readonly roles: readonly RoleDto[];
}): JSX.Element {
  if (roles.length === 0) {
    return (
      <EmptySection
        message="No roles have been indexed for this organization yet."
        title="No roles indexed"
      />
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Roles</h2>
        <StatusBadge tone="muted">{roles.length}</StatusBadge>
      </div>
      <div className="list-stack">
        {sortByNumeric(roles, (role) => role.roleId).map((role) => {
          const display = roleDisplay(role, role.roleId, undefined);
          const relatedMandates = mandates.filter(
            (mandate) =>
              mandate.roleId === role.roleId && mandate.bodyId === role.bodyId,
          );
          return (
            <div className="list-row governance-list-row" key={role.roleId}>
              <div>
                <strong>{display.title}</strong>
                <span>
                  Body #{role.bodyId} / {relatedMandates.length} mandates
                </span>
              </div>
              <div className="chip-row">
                <StatusBadge>{formatLabel(role.roleType)}</StatusBadge>
                <StatusBadge tone={role.active ? "success" : "muted"}>
                  {role.active ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MandatesTab({
  mandates,
  nowSeconds,
}: {
  readonly mandates: readonly MandateDto[];
  readonly nowSeconds: number;
}): JSX.Element {
  if (mandates.length === 0) {
    return (
      <EmptySection
        message="No holder mandates are indexed for this organization yet."
        title="No mandates indexed"
      />
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Mandates</h2>
        <StatusBadge tone="muted">{mandates.length}</StatusBadge>
      </div>
      <div className="list-stack">
        {sortByNumeric(mandates, (mandate) => mandate.mandateId).map(
          (mandate) => {
            const state = getMandateState(mandate, nowSeconds);
            return (
              <div
                className="list-row governance-list-row"
                key={mandate.mandateId}
              >
                <div className="governance-holder-cell">
                  <IsoAddressDisplay
                    showAvatar
                    size="compact"
                    value={mandate.holderAddress}
                  />
                  <span>
                    Mandate #{mandate.mandateId} / Body #{mandate.bodyId} / Role #
                    {mandate.roleId}
                  </span>
                </div>
                <div className="chip-row">
                  <span className="chip">
                    {getProposalScopeLabel(mandate.proposalTypeMask)}
                  </span>
                  <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                </div>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}

function PoliciesTab({
  policies,
  policiesError,
}: {
  readonly policies: readonly OrganizationPolicyDto[];
  readonly policiesError: Error | undefined;
}): JSX.Element {
  if (policiesError) {
    return (
      <EmptySection
        message={policiesError.message}
        title="Policy data unavailable"
      />
    );
  }

  if (policies.length === 0) {
    return (
      <EmptySection
        message="No policy rules are indexed for this organization yet."
        title="No policies indexed"
      />
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Policies</h2>
        <StatusBadge tone="muted">{policies.length}</StatusBadge>
      </div>
      <div className="list-stack">
        {sortPolicies(policies).map((policy) => (
          <PolicyRow key={`${policy.proposalType}:${policy.version}`} policy={policy} />
        ))}
      </div>
    </section>
  );
}

function RoutesTab({
  policies,
  policiesError,
}: {
  readonly policies: readonly OrganizationPolicyDto[];
  readonly policiesError: Error | undefined;
}): JSX.Element {
  if (policiesError) {
    return (
      <EmptySection
        message={policiesError.message}
        title="Route data unavailable"
      />
    );
  }

  if (policies.length === 0) {
    return (
      <EmptySection
        message="No policy routes can be shown until policy rules are indexed."
        title="No routes indexed"
      />
    );
  }

  return (
    <section className="governance-route-grid">
      {sortPolicies(policies).map((policy) => (
        <article
          className="panel governance-route-card"
          key={`${policy.proposalType}:${policy.version}`}
        >
          <div className="panel-header">
            <div>
              <h2>{formatLabel(policy.proposalType)} Route</h2>
              <p className="panel-subtitle">Policy v{policy.version}</p>
            </div>
            <StatusBadge tone={policy.enabled ? "success" : "muted"}>
              {policy.enabled ? "Enabled" : "Disabled"}
            </StatusBadge>
          </div>
          <dl className="detail-list detail-list-wide">
            <Detail
              label="Required approval bodies"
              value={formatRouteBodies(policy.requiredApprovalBodies)}
            />
            <Detail
              label="Veto bodies"
              value={formatRouteBodies(policy.vetoBodies)}
            />
            <Detail
              label="Executor body"
              value={
                policy.executorBody ? `Body #${policy.executorBody}` : "Not set"
              }
            />
            <Detail
              label="Timelock"
              value={formatDurationSeconds(policy.timelockSeconds)}
            />
          </dl>
        </article>
      ))}
    </section>
  );
}

function PolicyRow({
  policy,
}: {
  readonly policy: OrganizationPolicyDto;
}): JSX.Element {
  return (
    <div className="list-row governance-list-row">
      <div>
        <strong>{formatLabel(policy.proposalType)}</strong>
        <span>
          Policy v{policy.version} / Timelock{" "}
          {formatDurationSeconds(policy.timelockSeconds)}
        </span>
      </div>
      <div className="chip-row">
        <span className="chip">
          Approvals {policy.requiredApprovalBodies.length}
        </span>
        <span className="chip">Veto {policy.vetoBodies.length}</span>
        <StatusBadge tone={policy.enabled ? "success" : "muted"}>
          {policy.enabled ? "Enabled" : "Disabled"}
        </StatusBadge>
      </div>
    </div>
  );
}

function GraphLegend(): JSX.Element {
  return (
    <div className="governance-graph-legend" aria-label="Graph legend">
      <span>
        <i className="legend-line legend-line-authority" /> Authority
      </span>
      <span>
        <i className="legend-line legend-line-mandate" /> Mandate assignment
      </span>
      <span>
        <i className="legend-dot legend-dot-body" /> Body
      </span>
      <span>
        <i className="legend-dot legend-dot-role" /> Role
      </span>
      <span>
        <i className="legend-dot legend-dot-mandate" /> Mandate
      </span>
      <span>
        <i className="legend-dot legend-dot-policy" /> Policy
      </span>
    </div>
  );
}

function SelectedNodeInlineSummary({
  node,
}: {
  readonly node: GovernanceStructureNode;
}): JSX.Element {
  return (
    <div className="governance-selected-inline">
      <strong>{node.data.title}</strong>
      <span>{node.data.subtitle}</span>
      <StatusBadge tone={node.data.statusTone ?? "muted"}>
        {node.data.statusLabel ?? formatLabel(node.data.kind)}
      </StatusBadge>
    </div>
  );
}

function SelectedNodeDetails({
  node,
}: {
  readonly node: GovernanceStructureNode;
}): JSX.Element {
  return (
    <div className="governance-selected-details">
      <div>
        <strong>{node.data.title}</strong>
        <span>{node.data.subtitle}</span>
      </div>
      <StatusBadge tone={node.data.statusTone ?? "muted"}>
        {node.data.statusLabel ?? formatLabel(node.data.kind)}
      </StatusBadge>
      <DetailList details={node.data.detailItems} />
      {node.data.routePath ? (
        <Link className="diagnostics-text-link" to={node.data.routePath}>
          Open related page
        </Link>
      ) : null}
    </div>
  );
}

function DetailList({
  details,
}: {
  readonly details: readonly StructureNodeDetail[];
}): JSX.Element {
  return (
    <dl className="governance-structure-detail-list">
      {details.map((detail) => (
        <Detail key={detail.label} label={detail.label} value={detail.value} />
      ))}
    </dl>
  );
}

function Detail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EmptySection({
  message,
  title,
}: {
  readonly message: string;
  readonly title: string;
}): JSX.Element {
  return (
    <section className="state-panel">
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}

function GraphEmptyState({ orgId }: { readonly orgId: string }): JSX.Element {
  return (
    <div className="state-panel">
      <strong>No graph nodes available</strong>
      <p>
        This organization does not have enough indexed structure data to render
        an authority graph.
      </p>
      <Link className="button" to={`/orgs/${orgId}/setup`}>
        Continue activation
      </Link>
    </div>
  );
}

function getTabs({
  activeTab,
  onActiveTabChange,
  data,
  graphContent,
  model,
  nowSeconds,
  orgId: _orgId,
}: {
  readonly activeTab: string;
  readonly onActiveTabChange: (value: string) => void;
  readonly data: GovernanceStructureData;
  readonly graphContent: JSX.Element;
  readonly model: GovernanceStructureModel;
  readonly nowSeconds: number;
  readonly orgId: string;
}): readonly IsoTabItem[] {
  return [
    {
      content: graphContent,
      label: "Graph",
      value: "graph",
    },
    {
      content: (
        <BodiesTab
          activeTab={activeTab}
          bodies={data.bodies}
          mandates={data.mandates}
          onActiveTabChange={onActiveTabChange}
          roles={data.roles}
        />
      ),
      label: `Bodies (${data.bodies.length})`,
      value: "bodies",
    },
    {
      content: <RolesTab mandates={data.mandates} roles={data.roles} />,
      label: `Roles (${data.roles.length})`,
      value: "roles",
    },
    {
      content: <MandatesTab mandates={data.mandates} nowSeconds={nowSeconds} />,
      label: `Mandates (${data.mandates.length})`,
      value: "mandates",
    },
    {
      content: (
        <PoliciesTab
          policies={data.policies}
          policiesError={data.policiesError}
        />
      ),
      label: `Policies (${data.policies.length})`,
      value: "policies",
    },
    {
      content: (
        <RoutesTab
          policies={data.policies}
          policiesError={data.policiesError}
        />
      ),
      label: `Routes (${model.activePolicyCount})`,
      value: "routes",
    },
  ];
}

function GovernanceGraphListSwitch({
  onValueChange,
  value,
}: {
  readonly onValueChange: (value: string) => void;
  readonly value: "graph" | "bodies";
}): JSX.Element {
  return (
    <IsoSegmentedControl
      ariaLabel="Switch governance structure view"
      items={[
        {
          icon: <IsoIcon name="graph" size={15} />,
          label: "Graph",
          value: "graph",
        },
        {
          icon: <IsoIcon name="list" size={15} />,
          label: "List",
          value: "bodies",
        },
      ]}
      size="sm"
      value={value}
      onValueChange={onValueChange}
    />
  );
}

function isNodeVisibleWhenActive(node: GovernanceStructureNode): boolean {
  return (
    node.data.kind === "organization" ||
    node.data.statusLabel === undefined ||
    node.data.statusLabel === "Active" ||
    node.data.statusLabel === "Enabled" ||
    node.data.statusLabel === "Root authority"
  );
}

function formatRouteBodies(bodyIds: readonly string[]): string {
  return bodyIds.length
    ? bodyIds.map((bodyId) => `Body #${bodyId}`).join(", ")
    : "None";
}

async function loadOptional<TData>(
  load: () => Promise<TData>,
): Promise<{ readonly data?: TData; readonly error?: Error }> {
  try {
    return { data: await load() };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
