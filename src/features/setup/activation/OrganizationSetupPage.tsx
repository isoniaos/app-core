import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useActivationCapabilities } from "../../../api/useActivationCapabilities";
import { useOrganizationFinalization } from "../../../api/useOrganizationFinalization";
import { NotFoundPage } from "../../../app/NotFoundPage";
import { useRuntimeConfig } from "../../../config/runtime-config";
import { useTransactionModal } from "../../../transactions";
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
  const navigate = useNavigate();
  const orgId = requireParam(useParams().orgId, "orgId");
  const transactionModal = useTransactionModal();
  const modalWasOpen = useRef(transactionModal.state.open);
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
        chainId: runtimeConfig.activeDeployment.chainId,
        isoCoreAddress: runtimeConfig.activeDeployment.contracts.isoCoreAddress,
        inputs: activationInputs,
        orgId,
      }),
    [
      activationInputs,
      orgId,
      runtimeConfig.activeDeployment.chainId,
      runtimeConfig.activeDeployment.contracts.isoCoreAddress,
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
  const activationCompleted =
    finalization.finalized || finalizationAction.transaction.stage === "indexed";

  useEffect(() => {
    const wasOpen = modalWasOpen.current;
    const isOpen = transactionModal.state.open;
    modalWasOpen.current = isOpen;

    if (wasOpen && !isOpen && activationCompleted) {
      navigate(`/orgs/${orgId}/governance`, { replace: true });
    }
  }, [activationCompleted, navigate, orgId, transactionModal.state.open]);

  if (finalization.finalized && !transactionModal.state.open) {
    return <NotFoundPage />;
  }

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
        executeAssignMandateGroup={execution.executeAssignMandateGroup}
        executeCreateBodyGroup={execution.executeCreateBodyGroup}
        executeCreateRoleGroup={execution.executeCreateRoleGroup}
        executeSetPolicyRuleGroup={execution.executeSetPolicyRuleGroup}
        finalization={finalization}
        finalizationAction={finalizationAction}
        inputs={activationInputs}
        readModels={completionReadModels.data}
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
