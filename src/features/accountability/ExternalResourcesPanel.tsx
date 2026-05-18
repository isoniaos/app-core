import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { isNotFoundApiError } from "./accountability-display";
import { ExternalResourceCard } from "./ExternalResourceCard";

interface ExternalResourcesPanelProps {
  readonly orgId: string;
  readonly proposalId: string;
}

export function ExternalResourcesPanel({
  orgId,
  proposalId,
}: ExternalResourcesPanelProps): JSX.Element {
  const client = useIsoniaClient();
  const resources = useIsoniaQuery(
    () => client.externalResources.listForProposal(orgId, proposalId),
    [client, orgId, proposalId],
  );

  if (resources.loading) {
    return (
      <ExternalResourcesState
        title="Loading evidence"
        message="Reading external resources from the v0.8 Control Plane read model."
      />
    );
  }

  if (isNotFoundApiError(resources.error)) {
    return (
      <ExternalResourcesState
        title="Evidence not available yet"
        message="This Control Plane does not expose v0.8 external resources for this proposal yet."
      />
    );
  }

  if (resources.error) {
    return (
      <ExternalResourcesState
        actionLabel="Retry"
        message={resources.error.message}
        title="Unable to load evidence"
        onAction={resources.reload}
      />
    );
  }

  if (!resources.data || resources.data.length === 0) {
    return (
      <ExternalResourcesState
        title="No external evidence"
        message="No external resource records are linked to this proposal."
      />
    );
  }

  return (
    <div className="accountability-panel-stack">
      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Evidence</h2>
            <p>
              External records are rendered from Control Plane DTO snapshots.
              App Core does not call provider APIs or infer authority from links.
            </p>
          </div>
        </div>
        <div className="external-resource-grid">
          {resources.data.map((resource) => (
            <ExternalResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ExternalResourcesState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="calm-state accountability-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {onAction && actionLabel ? (
        <button className="button button-small" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
