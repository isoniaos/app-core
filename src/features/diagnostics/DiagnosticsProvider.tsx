import type { DiagnosticsDto } from "@isonia/types";
import {
  createContext,
  type PropsWithChildren,
  useContext,
} from "react";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import {
  type IsoniaQueryState,
  useIsoniaQuery,
} from "../../api/useIsoniaQuery";

const DiagnosticsContext = createContext<
  IsoniaQueryState<DiagnosticsDto> | undefined
>(undefined);

export function DiagnosticsProvider({
  children,
}: PropsWithChildren): JSX.Element {
  const client = useIsoniaClient();
  const diagnostics = useIsoniaQuery(() => client.diagnostics.get(), [client]);

  return (
    <DiagnosticsContext.Provider value={diagnostics}>
      {children}
    </DiagnosticsContext.Provider>
  );
}

export function useDiagnostics(): IsoniaQueryState<DiagnosticsDto> {
  const diagnostics = useContext(DiagnosticsContext);
  if (!diagnostics) {
    throw new Error("Diagnostics are not available.");
  }
  return diagnostics;
}
