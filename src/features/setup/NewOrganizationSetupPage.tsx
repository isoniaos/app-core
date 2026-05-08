import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleDaoPlusSetupWizard } from "./SimpleDaoPlusSetupWizard";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
} from "./setup-templates";
import { SetupExecutionPanel } from "./SetupExecutionPanel";
import { useSetupActionExecution } from "./useSetupActionExecution";

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
  const draftInputsLocked =
    execution.busy ||
    rootCreated;

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Organization creation"
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
            : undefined
        }
        reviewSupplement={
          <SetupExecutionPanel
            busy={execution.busy}
            draft={draft}
            executeCreateOrganization={execution.executeCreateOrganization}
            readiness={execution.readiness}
            reset={execution.reset}
            state={execution.state}
          />
        }
        onChange={setInputs}
      />
    </section>
  );
}
