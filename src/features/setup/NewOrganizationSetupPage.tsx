import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRuntimeConfig } from "../../config/runtime-config";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";
import { SimpleDaoPlusDraftForm } from "./SimpleDaoPlusDraftForm";
import {
  createSimpleDaoPlusDraft,
  DEFAULT_SIMPLE_DAO_PLUS_DRAFT_INPUTS,
  SETUP_TEMPLATES,
  SIMPLE_DAO_PLUS_TEMPLATE_ID,
} from "./setup-templates";
import { SetupExecutionPanel } from "./SetupExecutionPanel";
import { SetupDraftPreview, TemplateSelection } from "./SetupDraftPreview";
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
  const draftInputsLocked =
    execution.busy ||
    execution.state.createOrganization.stage === "indexed";

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Organization setup"
        title="New Organization"
        description="Start from a reviewable setup draft before the first setup transaction is signed and indexed in App Core."
      />

      <div className="action-row">
        <Link className="button" to="/diagnostics">
          Diagnostics
        </Link>
        <Link className="button" to="/orgs">
          Indexed organizations
        </Link>
        <StatusBadge
          tone={
            execution.state.createOrganization.stage === "indexed"
              ? "success"
              : "warning"
          }
        >
          Create organization only
        </StatusBadge>
      </div>

      <TemplateSelection
        selectedTemplateId={SIMPLE_DAO_PLUS_TEMPLATE_ID}
        templates={SETUP_TEMPLATES}
      />
      <SimpleDaoPlusDraftForm
        disabled={draftInputsLocked}
        inputs={inputs}
        onChange={setInputs}
      />
      <SetupDraftPreview draft={draft} />
      <SetupExecutionPanel
        busy={execution.busy}
        draft={draft}
        executeCreateOrganization={execution.executeCreateOrganization}
        readiness={execution.readiness}
        reset={execution.reset}
        state={execution.state}
      />
    </section>
  );
}
