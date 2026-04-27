import { createElement } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
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
      </div>
    );
  }

  return <InjectedWalletStatus />;
}

function InjectedWalletStatus(): JSX.Element {
  const account = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (account.isConnected) {
    return (
      <div className="wallet-status">
        <span className="wallet-address">
          {account.address ? formatAddress(account.address) : "Connected"}
        </span>
        <button className="button button-small" type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  const connector = connectors[0];

  return (
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
  );
}

