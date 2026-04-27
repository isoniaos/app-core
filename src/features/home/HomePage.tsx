import { Link } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { useRuntimeConfig } from "../../config/runtime-config";
import { AsyncContent } from "../../ui/AsyncContent";
import { PageHeader } from "../../ui/PageHeader";
import { StatusBadge } from "../../ui/StatusBadge";

interface SystemData {
  readonly healthStatus: string;
  readonly version: string;
  readonly chainId: number;
}

export function HomePage(): JSX.Element {
  const client = useIsoniaClient();
  const runtimeConfig = useRuntimeConfig();
  const system = useIsoniaQuery(
    async (): Promise<SystemData> => {
      const [health, version] = await Promise.all([
        client.getHealth(),
        client.getVersion(),
      ]);
      return {
        healthStatus: health.status,
        version: version.version,
        chainId: version.chainId,
      };
    },
    [client],
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={runtimeConfig.mode}
        title={runtimeConfig.appName}
        description="Self-hosted governance console foundation."
      />

      <div className="action-row">
        <Link className="button button-primary" to="/orgs">
          View organizations
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Control Plane</h2>
        </div>
        <AsyncContent state={system}>
          {(data) => (
            <div className="metric-grid">
              <div className="metric">
                <span>Status</span>
                <strong>
                  <StatusBadge
                    tone={data.healthStatus === "ok" ? "success" : "warning"}
                  >
                    {data.healthStatus}
                  </StatusBadge>
                </strong>
              </div>
              <div className="metric">
                <span>Version</span>
                <strong>{data.version}</strong>
              </div>
              <div className="metric">
                <span>Chain</span>
                <strong>{data.chainId}</strong>
              </div>
            </div>
          )}
        </AsyncContent>
      </section>
    </section>
  );
}

