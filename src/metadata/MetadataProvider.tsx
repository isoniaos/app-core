import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { RuntimeMetadataConfig } from "../config/runtime-config";
import { createMetadataResolver } from "./metadata-resolver";
import type { MetadataRecord, MetadataResolver } from "./types";

export interface MetadataState {
  readonly record: MetadataRecord | undefined;
  readonly loading: boolean;
}

const MetadataResolverContext = createContext<MetadataResolver | undefined>(
  undefined,
);

interface MetadataProviderProps extends PropsWithChildren {
  readonly config: RuntimeMetadataConfig;
}

export function MetadataProvider({
  children,
  config,
}: MetadataProviderProps): JSX.Element {
  const resolver = useMemo(() => createMetadataResolver(config), [config]);

  return (
    <MetadataResolverContext.Provider value={resolver}>
      {children}
    </MetadataResolverContext.Provider>
  );
}

export function useMetadataResolver(): MetadataResolver {
  const resolver = useContext(MetadataResolverContext);
  if (!resolver) {
    throw new Error("Metadata resolver is not available.");
  }
  return resolver;
}

export function useMetadata(uri: string | undefined): MetadataState {
  const resolver = useMetadataResolver();
  const [record, setRecord] = useState<MetadataRecord | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const normalized = resolver.normalize(uri);

    if (!normalized || !resolver.enabled) {
      setRecord(undefined);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setRecord(undefined);
    setLoading(true);
    resolver
      .resolve(uri)
      .then((nextRecord) => {
        if (active) {
          setRecord(nextRecord);
        }
      })
      .catch(() => {
        if (active) {
          setRecord(undefined);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [resolver, uri]);

  return { record, loading };
}
