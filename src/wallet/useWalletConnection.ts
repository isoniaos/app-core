import { useConnection } from "wagmi";

type WagmiConnection = ReturnType<typeof useConnection>;

export interface WalletConnection {
  readonly address: WagmiConnection["address"];
  readonly chainId: WagmiConnection["chainId"];
  readonly connector: WagmiConnection["connector"];
  readonly isConnected: WagmiConnection["isConnected"];
  readonly isConnecting: WagmiConnection["isConnecting"];
  readonly isReconnecting: WagmiConnection["isReconnecting"];
  readonly status: WagmiConnection["status"];
}

export function useWalletConnection(): WalletConnection {
  const connection = useConnection();

  return {
    address: connection.address,
    chainId: connection.chainId,
    connector: connection.connector,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isReconnecting: connection.isReconnecting,
    status: connection.status,
  };
}
