import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import { formatLabel } from "../../utils/format";
import { requireParam } from "../../utils/route-params";
import { OrganizationActivationWizard } from "./OrganizationActivationWizard";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
  type SimpleDaoPlusDraftInputs,
} from "./setup-templates";
import {
  verifySetupCompletion,
  type SetupCompletionReadModels,
} from "./setup-completion-verification";
import { useSetupCompletionReadModels } from "./useSetupCompletionReadModels";
import { useSetupActionExecution } from "./useSetupActionExecution";

export function OrganizationSetupPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const orgId = requireParam(useParams().orgId, "orgId");
  const [inputs, setInputs] = useState(DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS);
  const completionReadModels = useSetupCompletionReadModels(orgId);
  const activationInputs = useMemo(
    () => mergeIndexedOrganizationInputs(inputs, completionReadModels.data),
    [completionReadModels.data, inputs],
  );
  const draft = useMemo(
    () =>
      createSimpleDaoPlusDraft({
        chainId: runtimeConfig.chainId,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        inputs: activationInputs,
        orgId,
      }),
    [
      activationInputs,
      orgId,
      runtimeConfig.chainId,
      runtimeConfig.contracts.govCoreAddress,
    ],
  );
  const execution = useSetupActionExecution({
    draft,
    readModels: completionReadModels.data,
  });
  const completion = useMemo(
    () =>
      verifySetupCompletion({
        draft,
        executionState: execution.state,
        readModels: completionReadModels.data,
      }),
    [completionReadModels.data, draft, execution.state],
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Setup Activation"
        description="Activate the indexed organization root by creating bodies, roles, mandates, and policy routes."
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

      <OrganizationActivationWizard
        actions={draft.actions}
        busy={execution.busy}
        completion={completion}
        completionError={completionReadModels.error}
        completionLoading={completionReadModels.loading}
        completionReload={completionReadModels.reload}
        executeAssignMandate={execution.executeAssignMandate}
        executeAssignMandateGroup={execution.executeAssignMandateGroup}
        executeCreateBody={execution.executeCreateBody}
        executeCreateBodyGroup={execution.executeCreateBodyGroup}
        executeCreateRole={execution.executeCreateRole}
        executeCreateRoleGroup={execution.executeCreateRoleGroup}
        executeSetPolicyRule={execution.executeSetPolicyRule}
        executeSetPolicyRuleGroup={execution.executeSetPolicyRuleGroup}
        inputs={activationInputs}
        orgId={orgId}
        readModels={completionReadModels.data}
        state={execution.state}
        onChange={setInputs}
      />
    </section>
  );
}

function mergeIndexedOrganizationInputs(
  inputs: SimpleDaoPlusDraftInputs,
  readModels: SetupCompletionReadModels | undefined,
): SimpleDaoPlusDraftInputs {
  const organization = readModels?.organization;
  if (!organization) {
    return inputs;
  }

  return {
    ...inputs,
    organizationAdminAddress:
      inputs.organizationAdminAddress || organization.adminAddress,
    organizationMetadataUri:
      inputs.organizationMetadataUri || (organization.metadataUri ?? ""),
    organizationName: inputs.organizationName || organization.name,
    organizationSlug: inputs.organizationSlug || organization.slug,
  };
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
