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
import { SetupDraftPreview, TemplateSelection } from "./SetupDraftPreview";

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

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Organization setup"
        title="New Organization"
        description="Start from a reviewable setup draft before any protocol transaction flow exists in App Core."
      />

      <div className="action-row">
        <Link className="button" to="/diagnostics">
          Diagnostics
        </Link>
        <Link className="button" to="/orgs">
          Indexed organizations
        </Link>
        <StatusBadge tone="muted">No transactions</StatusBadge>
      </div>

      <TemplateSelection
        selectedTemplateId={SIMPLE_DAO_PLUS_TEMPLATE_ID}
        templates={SETUP_TEMPLATES}
      />
      <SimpleDaoPlusDraftForm inputs={inputs} onChange={setInputs} />
      <SetupDraftPreview draft={draft} />
    </section>
  );
}
