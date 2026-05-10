import { createElement } from "react";
import { useConnect, useDisconnect } from "wagmi";
import type { WalletSetupDiagnostic } from "../chain/wallet-setup";
import { useRuntimeConfig } from "../config/runtime-config";
import { IsoAddressAvatar, IsoIcon } from "../ui-kit";
import { formatAddress } from "../utils/format";
import { useWalletSetup } from "./WalletProvider";
import { useWalletConnection } from "./useWalletConnection";

export function WalletStatus(): JSX.Element {
  const setup = useWalletSetup();
  const connection = useWalletConnection();
  const runtimeConfig = useRuntimeConfig();
  const isWrongChain = isUnexpectedChain(
    connection.chainId,
    runtimeConfig.chainId,
  );

  if (setup.appKitEnabled) {
    return (
      <div className="wallet-status">
        <span className="wallet-appkit-button">
          {createElement("appkit-button", {
            balance: "hide",
            label: "Connect wallet",
            size: "sm",
          })}
        </span>
        {isWrongChain && connection.chainId ? (
          <span className="wallet-chain wallet-chain-warning">
            Chain {connection.chainId}
          </span>
        ) : null}
        <WalletDiagnostics diagnostics={setup.diagnostics} />
      </div>
    );
  }

  return <InjectedWalletStatus />;
}

function InjectedWalletStatus(): JSX.Element {
  const setup = useWalletSetup();
  const runtimeConfig = useRuntimeConfig();
  const connection = useWalletConnection();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const isWrongChain = isUnexpectedChain(
    connection.chainId,
    runtimeConfig.chainId,
  );

  if (connection.isConnected) {
    const addressLabel = connection.address
      ? formatAddress(connection.address)
      : "Connected";
    const chainLabel = getChainLabel(
      connection.chainId,
      runtimeConfig.chainId,
      runtimeConfig.chainName,
    );

    return (
      <div className="wallet-status">
        <button
          aria-label={`Disconnect wallet ${addressLabel} on ${chainLabel}.`}
          className={[
            "wallet-chip",
            isWrongChain ? "wallet-chip-warning" : "wallet-chip-connected",
          ].join(" ")}
          type="button"
          onClick={() => disconnect()}
          title="Disconnect wallet"
        >
          <IsoAddressAvatar
            className="wallet-chip-avatar"
            value={connection.address}
          />
          <span className="wallet-chip-main">
            <span className="wallet-chip-address">{addressLabel}</span>
            <span className="wallet-chip-chain">{chainLabel}</span>
          </span>
          <IsoIcon className="wallet-chip-action" name="x" size={15} />
        </button>
        <WalletDiagnostics diagnostics={setup.diagnostics} />
      </div>
    );
  }

  const connector = connectors[0];

  return (
    <div className="wallet-status">
      <button
        className="wallet-connect-button"
        type="button"
        disabled={!connector || isPending}
        onClick={() => {
          if (connector) {
            connect({ connector });
          }
        }}
      >
        <IsoIcon name="wallet" size={17} />
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
  const visibleDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.level !== "info",
  );

  if (visibleDiagnostics.length === 0) {
    return null;
  }

  return (
    <div className="wallet-diagnostics" role="status">
      {visibleDiagnostics.map((diagnostic) => (
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

function isUnexpectedChain(
  connectedChainId: number | undefined,
  expectedChainId: number,
): boolean {
  return connectedChainId !== undefined && connectedChainId !== expectedChainId;
}

function getChainLabel(
  connectedChainId: number | undefined,
  expectedChainId: number,
  expectedChainName: string,
): string {
  if (connectedChainId === undefined) {
    return "No chain";
  }

  if (connectedChainId === expectedChainId) {
    return expectedChainName;
  }

  return `Wrong chain ${connectedChainId}`;
}
