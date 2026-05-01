import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import type { IsoniaQueryState } from "../../api/useIsoniaQuery";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import type { SetupCompletionReadModels } from "./setup-completion-verification";

const EMPTY_SETUP_COMPLETION_READ_MODELS: SetupCompletionReadModels = {
  bodies: [],
  mandates: [],
  policies: [],
  roles: [],
};

export function useSetupCompletionReadModels(
  orgId: string | undefined,
): IsoniaQueryState<SetupCompletionReadModels> {
  const client = useIsoniaClient();

  return useIsoniaQuery(async (): Promise<SetupCompletionReadModels> => {
    if (!orgId) {
      return EMPTY_SETUP_COMPLETION_READ_MODELS;
    }

    const [organization, bodies, roles, mandates, policies] = await Promise.all([
      client.getOrganization(orgId),
      client.getBodies(orgId),
      client.getRoles(orgId),
      client.getMandates(orgId),
      client.policies.list(orgId),
    ]);

    return {
      bodies,
      mandates,
      organization,
      policies,
      roles,
    };
  }, [client, orgId]);
}
