import { useMemo } from "react";
import type { ActivationCapabilities } from "@isonia/types";
import { useRuntimeConfig } from "../config/runtime-config";
import {
  deriveActivationCapabilitiesState,
  loadControlPlaneCapabilities,
  type ActivationCapabilitiesDerivedState,
  type ControlPlaneCapabilitiesDto,
} from "./activation-capabilities";
import {
  type IsoniaQueryState,
  useIsoniaQuery,
} from "./useIsoniaQuery";

export interface ActivationCapabilitiesQuery
  extends IsoniaQueryState<ControlPlaneCapabilitiesDto>,
    ActivationCapabilitiesDerivedState {
  readonly activation: ActivationCapabilities | undefined;
}

export function useActivationCapabilities(): ActivationCapabilitiesQuery {
  const runtimeConfig = useRuntimeConfig();
  const query = useIsoniaQuery(
    () => loadControlPlaneCapabilities(runtimeConfig.apiBaseUrl),
    [runtimeConfig.apiBaseUrl],
  );
  const derived = useMemo(
    () =>
      deriveActivationCapabilitiesState({
        activation: query.data?.activation,
        error: query.error,
        loading: query.loading,
      }),
    [query.data?.activation, query.error, query.loading],
  );

  return {
    ...query,
    ...derived,
    activation: query.data?.activation,
  };
}
