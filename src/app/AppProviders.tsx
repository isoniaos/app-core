import type { PropsWithChildren } from "react";
import { IsoniaClientProvider } from "../api/IsoniaClientProvider";
import type { WalletSetup } from "../chain/wallet-setup";
import {
  RuntimeConfigProvider,
  type RuntimeConfig,
} from "../config/runtime-config";
import { MetadataProvider } from "../metadata/MetadataProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { WalletProvider } from "../wallet/WalletProvider";

interface AppProvidersProps extends PropsWithChildren {
  readonly runtimeConfig: RuntimeConfig;
  readonly walletSetup: WalletSetup;
}

export function AppProviders({
  children,
  runtimeConfig,
  walletSetup,
}: AppProvidersProps): JSX.Element {
  return (
    <RuntimeConfigProvider config={runtimeConfig}>
      <ThemeProvider>
        <MetadataProvider config={runtimeConfig.metadata}>
          <IsoniaClientProvider apiBaseUrl={runtimeConfig.apiBaseUrl}>
            <WalletProvider setup={walletSetup}>{children}</WalletProvider>
          </IsoniaClientProvider>
        </MetadataProvider>
      </ThemeProvider>
    </RuntimeConfigProvider>
  );
}
