import { useEffect, useState } from "react";
import type { Address } from "@isonia/types";
import {
  detectEip5792Capabilities,
  getEip5792ProviderFromConnector,
  type Eip5792CapabilityDetection,
} from "./eip5792";

const DISABLED_CAPABILITIES: Eip5792CapabilityDetection = {
  atomicRequired: false,
  canSendCalls: false,
  reason: "EIP-5792 batch activation feature flag is disabled.",
  status: "unsupported",
};

const CHECKING_CAPABILITIES: Eip5792CapabilityDetection = {
  atomicRequired: false,
  canSendCalls: false,
  reason: "Checking wallet batch capabilities.",
  status: "unknown",
};

export function useEip5792Capabilities({
  accountChainId,
  address,
  chainId,
  connected,
  connector,
  enabled,
}: {
  readonly accountChainId?: number;
  readonly address?: Address;
  readonly chainId: number;
  readonly connected: boolean;
  readonly connector: unknown;
  readonly enabled: boolean;
}): Eip5792CapabilityDetection {
  const [capabilities, setCapabilities] =
    useState<Eip5792CapabilityDetection>(
      enabled ? CHECKING_CAPABILITIES : DISABLED_CAPABILITIES,
    );

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setCapabilities(DISABLED_CAPABILITIES);
      return () => {
        cancelled = true;
      };
    }

    setCapabilities(CHECKING_CAPABILITIES);

    async function checkCapabilities(): Promise<void> {
      const provider = await getEip5792ProviderFromConnector(connector);
      const next = await detectEip5792Capabilities({
        accountChainId,
        address,
        chainId,
        connected,
        provider,
      });

      if (!cancelled) {
        setCapabilities(next);
      }
    }

    void checkCapabilities();

    return () => {
      cancelled = true;
    };
  }, [accountChainId, address, chainId, connected, connector, enabled]);

  return capabilities;
}
