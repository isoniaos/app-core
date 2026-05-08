import { useMemo, useState } from "react";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleDaoPlusSetupWizard } from "./SimpleDaoPlusSetupWizard";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
  SETUP_TEMPLATES,
  SIMPLE_DAO_PLUS_TEMPLATE_ID,
} from "./setup-templates";
import { SetupCompletionSummary } from "./SetupCompletionSummary";
import { SetupExecutionPanel } from "./SetupExecutionPanel";
import { verifySetupCompletion } from "./setup-completion-verification";
import { useSetupCompletionReadModels } from "./useSetupCompletionReadModels";
import { useSetupActionExecution } from "./useSetupActionExecution";

export function NewOrganizationSetupPage(): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const [inputs, setInputs] = useState(DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS);
  const draft = useMemo(
    () =>
      createSimpleDaoPlusDraft({
        chainId: runtimeConfig.chainId,
        govCoreAddress: runtimeConfig.contracts.govCoreAddress,
        inputs,
      }),
    [inputs, runtimeConfig.chainId, runtimeConfig.contracts.govCoreAddress],
  );
  const execution = useSetupActionExecution({ draft });
  const completionOrgId = execution.state.resolvedOrgId ?? draft.organization?.orgId;
  const completionReadModels = useSetupCompletionReadModels(completionOrgId);
  const completion = useMemo(
    () =>
      verifySetupCompletion({
        draft,
        executionState: execution.state,
        readModels: completionReadModels.data,
      }),
    [completionReadModels.data, draft, execution.state],
  );
  const draftInputsLocked =
    execution.busy ||
    execution.state.createOrganization.stage === "indexed";

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Organization setup"
        title="New Organization"
        description="Create a browser-side setup draft, review it, then submit the first setup transaction when the draft is ready."
      />

      <SimpleDaoPlusSetupWizard
        disabled={draftInputsLocked}
        draft={draft}
        inputs={inputs}
        reviewSupplement={
          <>
            <SetupExecutionPanel
              busy={execution.busy}
              draft={draft}
              executeAssignMandate={execution.executeAssignMandate}
              executeCreateBody={execution.executeCreateBody}
              executeCreateOrganization={execution.executeCreateOrganization}
              executeCreateRole={execution.executeCreateRole}
              executeSetPolicyRule={execution.executeSetPolicyRule}
              readiness={execution.readiness}
              reset={execution.reset}
              state={execution.state}
            />
            <details className="setup-technical-disclosure">
              <summary>Indexed completion check</summary>
              <SetupCompletionSummary
                completion={completion}
                error={completionReadModels.error}
                loading={Boolean(completionOrgId) && completionReadModels.loading}
                reload={completionReadModels.reload}
              />
            </details>
          </>
        }
        selectedTemplateId={SIMPLE_DAO_PLUS_TEMPLATE_ID}
        templates={SETUP_TEMPLATES}
        onChange={setInputs}
      />
    </section>
  );
}
