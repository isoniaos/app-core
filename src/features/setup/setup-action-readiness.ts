import type { Address, CreateOrganizationSetupAction } from "@isonia/types";
import type {
  SetupActionReadiness,
  SetupActionTransaction,
} from "./setup-action-execution-types";
import { isConfiguredAddress } from "./setup-action-execution-helpers";

export function getReadiness({
  accountChainId,
  action,
  connected,
  govCoreAddress,
  publicClientReady,
  runtimeChainId,
  setupWritesEnabled,
  transaction,
}: {
  readonly accountChainId: number | undefined;
  readonly action: CreateOrganizationSetupAction | undefined;
  readonly connected: boolean;
  readonly govCoreAddress: Address;
  readonly publicClientReady: boolean;
  readonly runtimeChainId: number;
  readonly setupWritesEnabled: boolean;
  readonly transaction: SetupActionTransaction;
}): SetupActionReadiness | undefined {
  if (transaction.stage === "indexed") {
    return {
      title: "Organization indexed",
      message: "The real orgId has been resolved from Control Plane read models.",
    };
  }

  if (!action) {
    return {
      title: "No create organization action",
      message: "This draft is already attached to an indexed organization.",
    };
  }

  if (!setupWritesEnabled) {
    return {
      title: "Setup writes disabled",
      message: "Enable features.writeActions and features.manageOrg in runtime config.",
    };
  }

  if (!isConfiguredAddress(govCoreAddress)) {
    return {
      title: "Protocol config missing",
      message: "Set contracts.govCoreAddress in runtime config.",
    };
  }

  if (action.warnings.some((warning) => warning.severity === "error")) {
    return {
      title: "Create organization blocked",
      message: "Resolve the create organization validation errors before submitting.",
    };
  }

  if (!connected) {
    return {
      title: "Wallet not connected",
      message: "Connect a wallet before submitting the setup action.",
    };
  }

  if (accountChainId !== runtimeChainId) {
    return {
      title: "Wrong chain",
      message: `Connected chain ${String(
        accountChainId,
      )}; expected chain ${runtimeChainId}.`,
    };
  }

  if (!publicClientReady) {
    return {
      title: "Protocol client unavailable",
      message: "The configured chain client is not ready.",
    };
  }

  return undefined;
}
