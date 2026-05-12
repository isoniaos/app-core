import {
  buildControlPlanePath,
  isContractBatchActivationMode,
  isSerialActivationMode,
  isWalletBatchEip5792Mode,
} from "@isonia/sdk";
import {
  ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES,
  ActivationCapabilityStatus,
  type ActivationCapabilities,
  type AdminBatchActivationFunctionName,
  type ChainId,
} from "@isonia/types";

export interface ControlPlaneCapabilitiesDto {
  readonly apiVersion: string;
  readonly chainId: ChainId;
  readonly activation: ActivationCapabilities;
  readonly generatedAt: string;
}

export interface ActivationCapabilitiesNotice {
  readonly message: string;
  readonly title: string;
  readonly tone: "muted" | "success" | "warning";
}

export interface ActivationCapabilitiesDerivedState {
  readonly contractBatchAvailableForAllAdminFunctions: boolean;
  readonly contractBatchSupported: boolean;
  readonly eip5792AvailableMode: boolean;
  readonly notice: ActivationCapabilitiesNotice;
  readonly serialFallbackAvailable: boolean;
}

export async function loadControlPlaneCapabilities(
  apiBaseUrl: string,
): Promise<ControlPlaneCapabilitiesDto> {
  const response = await fetch(
    `${normalizeBaseUrl(apiBaseUrl)}${buildControlPlanePath("capabilities")}`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Control Plane capabilities request failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as ControlPlaneCapabilitiesDto;
}

export function deriveActivationCapabilitiesState({
  activation,
  error,
  loading,
}: {
  readonly activation: ActivationCapabilities | undefined;
  readonly error: Error | undefined;
  readonly loading: boolean;
}): ActivationCapabilitiesDerivedState {
  const contractBatchSupported = isContractBatchSupported(activation);
  const serialFallbackAvailable = isSerialFallbackAvailable(activation);
  const eip5792AvailableMode = hasWalletBatchEip5792Mode(activation);
  const contractBatchAvailableForAllAdminFunctions =
    isContractBatchSupportedForFunctions(
      activation,
      ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES,
    );

  return {
    contractBatchAvailableForAllAdminFunctions,
    contractBatchSupported,
    eip5792AvailableMode,
    notice: getActivationCapabilitiesNotice({
      contractBatchSupported,
      error,
      loading,
    }),
    serialFallbackAvailable,
  };
}

export function isContractBatchSupported(
  activation: ActivationCapabilities | undefined,
): boolean {
  return (
    activation?.flags.contractBatch === true &&
    activation.contractBatch.status === ActivationCapabilityStatus.Supported &&
    activation.availableModes.some(isContractBatchActivationMode)
  );
}

export function isSerialFallbackAvailable(
  activation: ActivationCapabilities | undefined,
): boolean {
  if (!activation) {
    return true;
  }

  return (
    activation.flags.serial ||
    activation.availableModes.some(isSerialActivationMode)
  );
}

export function isContractBatchSupportedForFunctions(
  activation: ActivationCapabilities | undefined,
  functionNames: readonly AdminBatchActivationFunctionName[],
): boolean {
  if (!activation || !isContractBatchSupported(activation)) {
    return false;
  }

  const supportedFunctions = new Set(
    activation.contractBatch.supportedFunctions,
  );
  return functionNames.every((functionName) =>
    supportedFunctions.has(functionName),
  );
}

function hasWalletBatchEip5792Mode(
  activation: ActivationCapabilities | undefined,
): boolean {
  return activation?.availableModes.some(isWalletBatchEip5792Mode) ?? false;
}

function getActivationCapabilitiesNotice({
  contractBatchSupported,
  error,
  loading,
}: {
  readonly contractBatchSupported: boolean;
  readonly error: Error | undefined;
  readonly loading: boolean;
}): ActivationCapabilitiesNotice {
  if (error) {
    return {
      message: "Capability metadata unavailable; using serial activation.",
      title: "Using compatible serial activation",
      tone: "warning",
    };
  }

  if (loading) {
    return {
      message: "Checking activation capabilities. Serial activation remains available.",
      title: "Checking activation capabilities",
      tone: "muted",
    };
  }

  if (contractBatchSupported) {
    return {
      message: "Using optimized contract batch activation.",
      title: "Optimized activation available",
      tone: "success",
    };
  }

  return {
    message: "Using compatible serial activation.",
    title: "Compatible activation",
    tone: "muted",
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) {
    throw new Error("Isonia Control Plane baseUrl must not be empty.");
  }
  return trimmed;
}
