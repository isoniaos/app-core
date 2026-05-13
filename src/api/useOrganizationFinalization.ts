import { useMemo } from "react";
import type { OrganizationFinalizationReadModelDto } from "@isonia/types";
import { useRuntimeConfig } from "../config/runtime-config";
import {
  deriveOrganizationFinalizationState,
  loadOrganizationFinalization,
  type OrganizationFinalizationDerivedState,
} from "./organization-finalization";
import {
  type IsoniaQueryState,
  useIsoniaQuery,
} from "./useIsoniaQuery";

export interface OrganizationFinalizationQuery
  extends IsoniaQueryState<OrganizationFinalizationReadModelDto>,
    OrganizationFinalizationDerivedState {}

export function useOrganizationFinalization(
  orgId: string,
): OrganizationFinalizationQuery {
  const runtimeConfig = useRuntimeConfig();
  const query = useIsoniaQuery(
    () => loadOrganizationFinalization(runtimeConfig.apiBaseUrl, orgId),
    [runtimeConfig.apiBaseUrl, orgId],
  );
  const derived = useMemo(
    () =>
      deriveOrganizationFinalizationState({
        data: query.data,
        error: query.error,
        loading: query.loading,
        orgId,
      }),
    [orgId, query.data, query.error, query.loading],
  );

  return {
    ...query,
    ...derived,
  };
}
