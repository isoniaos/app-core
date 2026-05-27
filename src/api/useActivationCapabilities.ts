import { useMemo } from "react";
import type { ActivationCapabilities } from "@isonia/types";
import { useIsoniaClient } from "./IsoniaClientProvider";
import {
  deriveActivationCapabilitiesState,
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
  const client = useIsoniaClient();
  const query = useIsoniaQuery(
    () => client.capabilities.get(),
    [client],
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
