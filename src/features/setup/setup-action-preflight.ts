import type { Address, SetupAction } from "@isonia/types";
import { isConfiguredAddress, sameAddress } from "./setup-action-execution-helpers";

export type SetupActionExecutionPreflightStatus =
  | "ready"
  | "setup_writes_disabled"
  | "protocol_config_missing"
  | "required_signer_missing"
  | "wallet_not_connected"
  | "wrong_chain"
  | "wrong_signer"
  | "mixed_required_signers";

export interface SetupActionExecutionPreflight {
  readonly buttonLabel: string;
  readonly canExecute: boolean;
  readonly connectedSignerAddress?: Address;
  readonly expectedSignerAddress?: Address;
  readonly message: string;
  readonly status: SetupActionExecutionPreflightStatus;
  readonly title: string;
}

export interface SetupActionExecutionPreflightEnvironment {
  readonly accountChainId?: number;
  readonly connected: boolean;
  readonly connectedAddress?: Address;
  readonly isoCoreAddress: Address | undefined;
  readonly runtimeChainId: number;
  readonly setupWritesEnabled: boolean;
}

export function getSetupActionExecutionPreflight(
  action: SetupAction,
  environment: SetupActionExecutionPreflightEnvironment,
): SetupActionExecutionPreflight {
  return getBaseSetupExecutionPreflight({
    ...environment,
    expectedSignerAddress: action.requiredSignerAddress,
  });
}

export function getSetupActionGroupExecutionPreflight(
  actions: readonly SetupAction[],
  environment: SetupActionExecutionPreflightEnvironment,
): SetupActionExecutionPreflight {
  const expectedSigners = uniqueAddresses(
    actions
      .map((action) => action.requiredSignerAddress)
      .filter((address): address is Address => Boolean(address)),
  );

  if (
    expectedSigners.length > 1 &&
    environment.setupWritesEnabled &&
    isConfiguredAddress(environment.isoCoreAddress)
  ) {
    return {
      buttonLabel: "Run one by one",
      canExecute: false,
      connectedSignerAddress: environment.connectedAddress,
      expectedSignerAddress: undefined,
      message:
        "This step has multiple expected signers. Run the actions one by one.",
      status: "mixed_required_signers",
      title: "Multiple required signers",
    };
  }

  return getBaseSetupExecutionPreflight({
    ...environment,
    expectedSignerAddress: expectedSigners[0],
  });
}

function getBaseSetupExecutionPreflight({
  accountChainId,
  connected,
  connectedAddress,
  expectedSignerAddress,
  isoCoreAddress,
  runtimeChainId,
  setupWritesEnabled,
}: SetupActionExecutionPreflightEnvironment & {
  readonly expectedSignerAddress?: Address;
}): SetupActionExecutionPreflight {
  if (!setupWritesEnabled) {
    return {
      buttonLabel: "Writes disabled",
      canExecute: false,
      connectedSignerAddress: connectedAddress,
      expectedSignerAddress,
      message:
        "Enable write actions and organization management in runtime config.",
      status: "setup_writes_disabled",
      title: "Setup writes disabled",
    };
  }

  if (!isConfiguredAddress(isoCoreAddress)) {
    return {
      buttonLabel: "Protocol config missing",
      canExecute: false,
      connectedSignerAddress: connectedAddress,
      expectedSignerAddress,
      message: "Set activeDeployment.contracts.isoCoreAddress in runtime config.",
      status: "protocol_config_missing",
      title: "Protocol config missing",
    };
  }

  if (!expectedSignerAddress) {
    return {
      buttonLabel: "Signer unavailable",
      canExecute: false,
      connectedSignerAddress: connectedAddress,
      expectedSignerAddress,
      message: "Required signer is not available in this draft.",
      status: "required_signer_missing",
      title: "Required signer unavailable",
    };
  }

  if (!connected || !connectedAddress) {
    return {
      buttonLabel: "Connect wallet",
      canExecute: false,
      connectedSignerAddress: connectedAddress,
      expectedSignerAddress,
      message:
        "Connect the organization admin wallet to execute this bootstrap action.",
      status: "wallet_not_connected",
      title: "Wallet not connected",
    };
  }

  if (accountChainId !== runtimeChainId) {
    return {
      buttonLabel: "Switch chain",
      canExecute: false,
      connectedSignerAddress: connectedAddress,
      expectedSignerAddress,
      message: `Connected chain ${String(
        accountChainId,
      )}; expected chain ${runtimeChainId}.`,
      status: "wrong_chain",
      title: "Wrong chain",
    };
  }

  if (!sameAddress(connectedAddress, expectedSignerAddress)) {
    return {
      buttonLabel: "Switch wallet",
      canExecute: false,
      connectedSignerAddress: connectedAddress,
      expectedSignerAddress,
      message:
        "Switch to organization admin wallet to execute this bootstrap action.",
      status: "wrong_signer",
      title: "Connected wallet does not match the expected organization admin",
    };
  }

  return {
    buttonLabel: "Execute",
    canExecute: true,
    connectedSignerAddress: connectedAddress,
    expectedSignerAddress,
    message: "Ready to execute with the expected organization admin wallet.",
    status: "ready",
    title: "Signer ready",
  };
}

function uniqueAddresses(addresses: readonly Address[]): readonly Address[] {
  const seen = new Set<string>();
  const unique: Address[] = [];

  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(address);
  }

  return unique;
}
