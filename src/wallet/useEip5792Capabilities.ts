import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "@isonia/types";
import {
  detectEip5792Capabilities,
  getEip5792ProviderContext,
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

const WALLET_DISCONNECTED_CAPABILITIES: Eip5792CapabilityDetection = {
  atomicRequired: false,
  canSendCalls: false,
  reason: "Connect a wallet before checking batch support.",
  status: "unsupported",
};

export interface UseEip5792CapabilitiesResult {
  readonly capabilities: Eip5792CapabilityDetection;
  readonly checking: boolean;
  readonly refresh: () => Promise<Eip5792CapabilityDetection>;
}

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
}): UseEip5792CapabilitiesResult {
  const [capabilities, setCapabilities] =
    useState<Eip5792CapabilityDetection>(
      enabled ? CHECKING_CAPABILITIES : DISABLED_CAPABILITIES,
    );
  const [checking, setChecking] = useState(enabled);
  const mounted = useRef(true);
  const connectorRef = useRef(connector);
  const connectorKey = getConnectorKey(connector);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    connectorRef.current = connector;
  }, [connector]);

  const refresh = useCallback(async (): Promise<Eip5792CapabilityDetection> => {
    if (!enabled) {
      if (mounted.current) {
        setCapabilities(DISABLED_CAPABILITIES);
        setChecking(false);
      }
      return DISABLED_CAPABILITIES;
    }

    if (!connected || !address) {
      if (mounted.current) {
        setCapabilities(WALLET_DISCONNECTED_CAPABILITIES);
        setChecking(false);
      }
      return WALLET_DISCONNECTED_CAPABILITIES;
    }

    if (mounted.current) {
      setCapabilities((current) => ({
        ...CHECKING_CAPABILITIES,
        diagnostics: current.diagnostics,
      }));
      setChecking(true);
    }

    const { diagnostics, provider } = await getEip5792ProviderContext(
      connectorRef.current,
    );
    const next = await detectEip5792Capabilities({
      accountChainId,
      address,
      chainId,
      connected,
      provider,
      providerDiagnostics: diagnostics,
    });

    if (mounted.current) {
      setCapabilities(next);
      setChecking(false);
    }

    return next;
  }, [accountChainId, address, chainId, connected, enabled]);

  useEffect(() => {
    void refresh();
  }, [connectorKey, refresh]);

  return {
    capabilities,
    checking,
    refresh,
  };
}

function getConnectorKey(connector: unknown): string {
  if (!connector || typeof connector !== "object") {
    return "none";
  }

  const record = connector as Record<string, unknown>;
  return [
    readConnectorKeyPart(record.id),
    readConnectorKeyPart(record.name),
    readConnectorKeyPart(record.uid),
    readConnectorKeyPart(record.type),
    readConnectorKeyPart(record.rdns),
  ]
    .filter(Boolean)
    .join(":") || "object";
}

function readConnectorKeyPart(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
