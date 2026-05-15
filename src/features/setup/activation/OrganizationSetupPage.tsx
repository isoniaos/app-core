import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useActivationCapabilities } from "../../../api/useActivationCapabilities";
import { useOrganizationFinalization } from "../../../api/useOrganizationFinalization";
import { useRuntimeConfig } from "../../../config/runtime-config";
import { PageHeader } from "../../../ui/PageHeader";
import { requireParam } from "../../../utils/route-params";
import { OrganizationActivationWizard } from "./OrganizationActivationWizard";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
  type SimpleDaoPlusDraftInputs,
} from "../setup-templates";
import {
  verifySetupCompletion,
  type SetupCompletionReadModels,
} from "../setup-completion-verification";
import { useSetupCompletionReadModels } from "../useSetupCompletionReadModels";
import { useOrganizationFinalizationAction } from "../useOrganizationFinalizationAction";
import { useSetupActionExecution } from "../useSetupActionExecution";

export function OrganizationSetupPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const orgId = requireParam(useParams().orgId, "orgId");
  const [inputs, setInputs] = useState(DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS);
  const completionReadModels = useSetupCompletionReadModels(orgId);
  const activationCapabilities = useActivationCapabilities();
  const finalization = useOrganizationFinalization(orgId);
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
    activationCapabilities: activationCapabilities.activation,
    draft,
    readModels: completionReadModels.data,
  });
  const finalizationAction = useOrganizationFinalizationAction({
    adminAddress: completionReadModels.data?.organization?.adminAddress,
    finalization: finalization.data,
    finalizationError: finalization.error,
    finalizationLoading: finalization.loading,
    onIndexed: () => {
      finalization.reload();
      completionReadModels.reload();
    },
    orgId,
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
        breadcrumbs={[
          {
            icon: "home",
            label: "Home",
            to: "/",
          },
          {
            icon: "building",
            label: "Organizations",
            to: "/orgs",
          },
          {
            current: true,
            icon: "setup",
            label: "Setup Activation",
          },
        ]}
        title="Setup Activation"
        description="Activate the indexed organization root by creating bodies, roles, mandates, and policy routes."
      />

      <OrganizationActivationWizard
        activationCapabilities={activationCapabilities}
        actions={draft.actions}
        busy={execution.busy}
        completion={completion}
        completionError={completionReadModels.error}
        completionLoading={completionReadModels.loading}
        completionReload={completionReadModels.reload}
        eip5792BatchCapability={execution.eip5792BatchCapability}
        eip5792BatchChecking={execution.eip5792BatchChecking}
        eip5792BatchFeatureEnabled={execution.eip5792BatchFeatureEnabled}
        executeAssignMandate={execution.executeAssignMandate}
        executeAssignMandateGroupBatch={execution.executeAssignMandateGroupBatch}
        executeAssignMandateGroup={execution.executeAssignMandateGroup}
        executeCreateBody={execution.executeCreateBody}
        executeCreateBodyGroupBatch={execution.executeCreateBodyGroupBatch}
        executeCreateBodyGroup={execution.executeCreateBodyGroup}
        executeCreateRole={execution.executeCreateRole}
        executeCreateRoleGroupBatch={execution.executeCreateRoleGroupBatch}
        executeCreateRoleGroup={execution.executeCreateRoleGroup}
        executeSetPolicyRule={execution.executeSetPolicyRule}
        executeSetPolicyRuleGroupBatch={execution.executeSetPolicyRuleGroupBatch}
        executeSetPolicyRuleGroup={execution.executeSetPolicyRuleGroup}
        finalization={finalization}
        finalizationAction={finalizationAction}
        inputs={activationInputs}
        orgId={orgId}
        readModels={completionReadModels.data}
        refreshEip5792BatchCapability={execution.refreshEip5792BatchCapability}
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
