import {
  createContext,
  lazy,
  type PropsWithChildren,
  Suspense,
  useContext,
  useState,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import type { WalletSetup } from "../chain/wallet-setup";

const ReownThemeBridge = lazy(() =>
  import("./ReownThemeBridge").then((module) => ({
    default: module.ReownThemeBridge,
  })),
);

const WalletSetupContext = createContext<WalletSetup | undefined>(undefined);

interface WalletProviderProps extends PropsWithChildren {
  readonly setup: WalletSetup;
}

export function WalletProvider({
  children,
  setup,
}: WalletProviderProps): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WalletSetupContext.Provider value={setup}>
      <WagmiProvider config={setup.wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {setup.appKitEnabled ? (
            <Suspense fallback={null}>
              <ReownThemeBridge />
            </Suspense>
          ) : null}
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </WalletSetupContext.Provider>
  );
}

export function useWalletSetup(): WalletSetup {
  const setup = useContext(WalletSetupContext);
  if (!setup) {
    throw new Error("Wallet setup is not available.");
  }
  return setup;
}
