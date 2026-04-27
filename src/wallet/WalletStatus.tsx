import { createElement } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { WalletSetupDiagnostic } from "../chain/wallet-setup";
import { formatAddress } from "../utils/format";
import { useWalletSetup } from "./WalletProvider";

export function WalletStatus(): JSX.Element {
  const setup = useWalletSetup();
  const account = useAccount();

  if (setup.appKitEnabled) {
    return (
      <div className="wallet-status">
        {createElement("appkit-button")}
        {account.chainId ? (
          <span className="wallet-chain">Chain {account.chainId}</span>
        ) : null}
        <WalletDiagnostics diagnostics={setup.diagnostics} />
      </div>
    );
  }

  return <InjectedWalletStatus />;
}

function InjectedWalletStatus(): JSX.Element {
  const setup = useWalletSetup();
  const account = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (account.isConnected) {
    return (
      <div className="wallet-status">
        <span className="wallet-address">
          {account.address ? formatAddress(account.address) : "Connected"}
        </span>
        <button
          className="button button-small"
          type="button"
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
        <WalletDiagnostics diagnostics={setup.diagnostics} />
      </div>
    );
  }

  const connector = connectors[0];

  return (
    <div className="wallet-status">
      <button
        className="button button-primary"
        type="button"
        disabled={!connector || isPending}
        onClick={() => {
          if (connector) {
            connect({ connector });
          }
        }}
      >
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
      <WalletDiagnostics diagnostics={setup.diagnostics} />
    </div>
  );
}

function WalletDiagnostics({
  diagnostics,
}: {
  readonly diagnostics: readonly WalletSetupDiagnostic[];
}): JSX.Element | null {
  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="wallet-diagnostics" role="status">
      {diagnostics.map((diagnostic) => (
        <span
          className={`wallet-diagnostic wallet-diagnostic-${diagnostic.level}`}
          key={diagnostic.code}
          title={diagnostic.detail}
        >
          {diagnostic.message}
        </span>
      ))}
    </div>
  );
}
