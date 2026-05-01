import type { OrganizationPolicyDto } from "@isonia/types";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import type { IsoniaQueryState } from "../../api/useIsoniaQuery";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useRuntimeConfig } from "../../config/runtime-config";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import { formatLabel, formatNumericString } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { SimpleDaoPlusDraftForm } from "./SimpleDaoPlusDraftForm";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
  SETUP_TEMPLATES,
  SIMPLE_DAO_PLUS_TEMPLATE_ID,
} from "./setup-templates";
import { SetupCompletionSummary } from "./SetupCompletionSummary";
import { SetupDraftPreview, TemplateSelection } from "./SetupDraftPreview";
import { verifySetupCompletion } from "./setup-completion-verification";
import { useSetupCompletionReadModels } from "./useSetupCompletionReadModels";

export function OrganizationSetupPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const [inputs, setInputs] = useState(DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS);
  const policies = useIsoniaQuery(() => client.policies.list(orgId), [
    client,
    orgId,
  ]);
  const completionReadModels = useSetupCompletionReadModels(orgId);
  const draft = useMemo(
    () =>
      createSimpleDaoPlusDraft({
        chainId: runtimeConfig.chainId,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        inputs,
        orgId,
      }),
    [inputs, orgId, runtimeConfig.chainId, runtimeConfig.contracts.govCoreAddress],
  );
  const completion = useMemo(
    () =>
      verifySetupCompletion({
        draft,
        readModels: completionReadModels.data,
      }),
    [completionReadModels.data, draft],
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Setup"
        description="Review setup draft state alongside the current indexed policy routes."
      />

      <div className="action-row">
        <Link className="button" to={`/orgs/${orgId}`}>
          Overview
        </Link>
        <Link className="button" to="/diagnostics">
          Diagnostics
        </Link>
        <StatusBadge tone={getCompletionTone(completion.readiness)}>
          {formatLabel(completion.readiness)}
        </StatusBadge>
      </div>

      <TemplateSelection
        selectedTemplateId={SIMPLE_DAO_PLUS_TEMPLATE_ID}
        templates={SETUP_TEMPLATES}
      />
      <SimpleDaoPlusDraftForm inputs={inputs} onChange={setInputs} />
      <SetupDraftPreview draft={draft} />
      <SetupCompletionSummary
        completion={completion}
        error={completionReadModels.error}
        loading={completionReadModels.loading}
        reload={completionReadModels.reload}
      />
      <IndexedPoliciesPanel orgId={orgId} policies={policies} />
    </section>
  );
}

function getCompletionTone(
  readiness: ReturnType<typeof verifySetupCompletion>["readiness"],
): "default" | "success" | "warning" | "danger" | "muted" {
  switch (readiness) {
    case "completed":
      return "success";
    case "blocked":
      return "danger";
    case "in_progress":
    case "partially_indexed":
      return "warning";
    case "not_started":
      return "muted";
  }
}

function IndexedPoliciesPanel({
  orgId,
  policies,
}: {
  readonly orgId: string;
  readonly policies: IsoniaQueryState<readonly OrganizationPolicyDto[]>;
}): JSX.Element {
  return (
    <section className="panel" id="indexed-policies">
      <div className="panel-header">
        <div>
          <h2>Current Indexed Policies</h2>
          <p className="panel-subtitle">
            Read-only policy rules projected by Control Plane for org #{orgId}.
          </p>
        </div>
        <Link className="button button-small" to="/diagnostics">
          Diagnostics
        </Link>
      </div>

      {policies.loading ? (
        <div className="state-panel" role="status">
          <span className="loading-bar" />
          <strong>Loading policies</strong>
          <p>Reading indexed policy routes from the Control Plane API.</p>
        </div>
      ) : null}

      {policies.error ? (
        <div className="state-panel state-panel-error">
          <strong>Unable to load indexed policies</strong>
          <p>{policies.error.message}</p>
          <div className="action-row">
            <button className="button" type="button" onClick={policies.reload}>
              Retry
            </button>
            <Link className="button" to="/diagnostics">
              Open diagnostics
            </Link>
          </div>
        </div>
      ) : null}

      {!policies.loading && !policies.error && policies.data?.length === 0 ? (
        <div className="state-panel">
          <strong>No policies indexed</strong>
          <p>
            This organization has no policy rules in the current read model.
            Check diagnostics if setup transactions were already submitted.
          </p>
          <Link className="button" to="/diagnostics">
            Open diagnostics
          </Link>
        </div>
      ) : null}

      {!policies.loading && !policies.error && policies.data ? (
        policies.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proposal type</th>
                  <th>Version</th>
                  <th>Approvals</th>
                  <th>Veto</th>
                  <th>Executor</th>
                  <th>Timelock</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {policies.data.map((policy) => (
                  <PolicyRow key={getPolicyKey(policy)} policy={policy} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      ) : null}
    </section>
  );
}

function PolicyRow({
  policy,
}: {
  readonly policy: OrganizationPolicyDto;
}): JSX.Element {
  return (
    <tr>
      <td>{formatLabel(policy.proposalType)}</td>
      <td>v{policy.version}</td>
      <td>
        <PolicyBodyChips bodyIds={policy.requiredApprovalBodies} />
      </td>
      <td>
        <PolicyBodyChips bodyIds={policy.vetoBodies} />
      </td>
      <td>{policy.executorBody ? `Body #${policy.executorBody}` : "None"}</td>
      <td>{formatNumericString(policy.timelockSeconds)}s</td>
      <td>
        <StatusBadge tone={policy.enabled ? "success" : "muted"}>
          {policy.enabled ? "Enabled" : "Disabled"}
        </StatusBadge>
      </td>
      <td>
        <DataStatusBadge status={policy.dataStatus} />
      </td>
    </tr>
  );
}

function PolicyBodyChips({
  bodyIds,
}: {
  readonly bodyIds: readonly string[];
}): JSX.Element {
  if (bodyIds.length === 0) {
    return <span className="chip">None</span>;
  }

  return (
    <span className="chip-row">
      {bodyIds.map((bodyId) => (
        <span className="chip" key={bodyId}>
          Body #{bodyId}
        </span>
      ))}
    </span>
  );
}

function getPolicyKey(policy: OrganizationPolicyDto): string {
  return `${policy.orgId}:${policy.proposalType}:${policy.version}`;
}
