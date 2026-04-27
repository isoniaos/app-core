import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import {
  createIsoniaControlPlaneClient,
  type IsoniaControlPlaneClient,
} from "@isonia/sdk";

const IsoniaClientContext = createContext<IsoniaControlPlaneClient | undefined>(
  undefined,
);

interface IsoniaClientProviderProps extends PropsWithChildren {
  readonly apiBaseUrl: string;
}

export function IsoniaClientProvider({
  apiBaseUrl,
  children,
}: IsoniaClientProviderProps): JSX.Element {
  const client = useMemo(
    () => createIsoniaControlPlaneClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl],
  );

  return (
    <IsoniaClientContext.Provider value={client}>
      {children}
    </IsoniaClientContext.Provider>
  );
}

export function useIsoniaClient(): IsoniaControlPlaneClient {
  const client = useContext(IsoniaClientContext);
  if (!client) {
    throw new Error("Isonia client is not available.");
  }
  return client;
}

