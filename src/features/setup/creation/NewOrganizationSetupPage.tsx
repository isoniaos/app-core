import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRuntimeConfig } from "../../../config/runtime-config";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleDaoPlusSetupWizard } from "./SimpleDaoPlusSetupWizard";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
} from "../setup-templates";
import {
  useSetupActionExecution,
  type SetupActionLifecycleStage,
} from "../useSetupActionExecution";

export function NewOrganizationSetupPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const navigate = useNavigate();
  const [inputs, setInputs] = useState(DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS);
  const draft = useMemo(
    () =>
      createSimpleDaoPlusDraft({
        chainId: runtimeConfig.chainId,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        includeActivationActions: false,
        inputs,
      }),
    [inputs, runtimeConfig.chainId, runtimeConfig.contracts.govCoreAddress],
  );
  const execution = useSetupActionExecution({ draft });
  const activationOrgId = execution.state.resolvedOrgId;
  const rootCreated =
    execution.state.createOrganization.stage === "indexed" ||
    Boolean(activationOrgId);
  const rootCreationBlocked = draft.warnings.some(
    (warning) => warning.severity === "error",
  );
  const draftInputsLocked =
    execution.busy ||
    rootCreated;

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
            icon: "add",
            label: "New organization",
          },
        ]}
        title="New Organization"
        description="Create the organization root first. Bodies, roles, mandates, and policy routes continue from the activation page after indexing."
      />

      <SimpleDaoPlusSetupWizard
        disabled={draftInputsLocked}
        draft={draft}
        inputs={inputs}
        reviewPrimaryAction={
          rootCreated
            ? {
                disabled: !activationOrgId,
                label: "Continue Activation",
                onClick: () => {
                  if (activationOrgId) {
                    navigate(`/orgs/${activationOrgId}/setup`);
                  }
                },
              }
            : {
                disabled: execution.busy || rootCreationBlocked,
                label: getRootCreationButtonLabel(
                  execution.state.createOrganization.stage,
                  execution.busy,
                  rootCreationBlocked,
                ),
                onClick: () => {
                  void execution.executeCreateOrganization();
                },
              }
        }
        onChange={setInputs}
      />
    </section>
  );
}

function getRootCreationButtonLabel(
  stage: SetupActionLifecycleStage,
  busy: boolean,
  blocked: boolean,
): string {
  if (stage === "failed") {
    return "Retry root creation";
  }

  if (stage === "wallet_pending") {
    return "Waiting for wallet";
  }

  if (stage === "submitted") {
    return "Transaction submitted";
  }

  if (stage === "confirming") {
    return "Waiting for receipt";
  }

  if (stage === "confirmed_waiting_indexer") {
    return "Waiting for Control Plane";
  }

  if (busy) {
    return "Transaction active";
  }

  if (blocked) {
    return "Root creation blocked";
  }

  return "Create root";
}
