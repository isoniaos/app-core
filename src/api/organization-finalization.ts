import {
  createOrganizationFinalizationReadPlan,
  isOrganizationFinalizedStatus,
  isOrganizationNotFinalizedStatus,
  type OrganizationFinalizationReadPlan,
} from "@isonia/sdk";
import {
  ORGANIZATION_FINALIZATION_STATUSES,
  type OrganizationFinalizationReadModelDto,
} from "@isonia/types";

export type OrganizationFinalizationStatusTone =
  | "success"
  | "warning"
  | "muted";

export interface OrganizationFinalizationDerivedState {
  readonly endpointReachable: boolean;
  readonly endpointUnavailable: boolean;
  readonly finalized: boolean;
  readonly notFinalized: boolean;
  readonly readPlan: OrganizationFinalizationReadPlan;
  readonly statusCopy: string;
  readonly statusLabel: string;
  readonly statusTone: OrganizationFinalizationStatusTone;
  readonly unknown: boolean;
  readonly unsupported: boolean;
}

export function deriveOrganizationFinalizationState({
  data,
  error,
  loading,
  orgId,
}: {
  readonly data: OrganizationFinalizationReadModelDto | undefined;
  readonly error: Error | undefined;
  readonly loading: boolean;
  readonly orgId: string;
}): OrganizationFinalizationDerivedState {
  const finalized = data
    ? data.finalized === true ||
      isOrganizationFinalizedStatus(data.finalizationStatus)
    : false;
  const notFinalized = data
    ? data.finalized === false ||
      isOrganizationNotFinalizedStatus(data.finalizationStatus)
    : false;
  const unsupported =
    data?.finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Unsupported;
  const unknown =
    !data ||
    data.finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Unknown ||
    (!finalized && !notFinalized && !unsupported);

  return {
    endpointReachable: Boolean(data) && !error,
    endpointUnavailable: Boolean(error),
    finalized,
    notFinalized,
    readPlan: createOrganizationFinalizationReadPlan({ orgId }),
    statusCopy: getFinalizationStatusCopy({
      error,
      finalized,
      loading,
      notFinalized,
      unsupported,
      unknown,
    }),
    statusLabel: getFinalizationStatusLabel({
      error,
      finalized,
      loading,
      notFinalized,
      unsupported,
    }),
    statusTone: getFinalizationStatusTone({
      error,
      finalized,
      notFinalized,
      unsupported,
    }),
    unknown,
    unsupported,
  };
}

function getFinalizationStatusLabel({
  error,
  finalized,
  loading,
  notFinalized,
  unsupported,
}: {
  readonly error: Error | undefined;
  readonly finalized: boolean;
  readonly loading: boolean;
  readonly notFinalized: boolean;
  readonly unsupported: boolean;
}): string {
  if (error) {
    return "Finalization status unavailable";
  }
  if (loading) {
    return "Checking finalization";
  }
  if (finalized) {
    return "Finalized";
  }
  if (notFinalized) {
    return "Not finalized";
  }
  if (unsupported) {
    return "Finalization unsupported";
  }
  return "Finalization status unavailable";
}

function getFinalizationStatusCopy({
  error,
  finalized,
  loading,
  notFinalized,
  unsupported,
  unknown,
}: {
  readonly error: Error | undefined;
  readonly finalized: boolean;
  readonly loading: boolean;
  readonly notFinalized: boolean;
  readonly unsupported: boolean;
  readonly unknown: boolean;
}): string {
  if (error) {
    return "Control Plane finalization metadata is unavailable. Organization read screens remain usable.";
  }
  if (loading) {
    return "Reading organization finalization metadata from Control Plane.";
  }
  if (finalized) {
    return "Bootstrap admin mutations are closed. Indexed governance remains readable.";
  }
  if (notFinalized) {
    return "Bootstrap admin mutations remain available until finalization.";
  }
  if (unsupported) {
    return "The configured Control Plane does not report organization finalization support.";
  }
  if (unknown) {
    return "Control Plane cannot confirm whether this organization has been finalized.";
  }
  return "Finalization metadata is unavailable.";
}

function getFinalizationStatusTone({
  error,
  finalized,
  notFinalized,
  unsupported,
}: {
  readonly error: Error | undefined;
  readonly finalized: boolean;
  readonly notFinalized: boolean;
  readonly unsupported: boolean;
}): OrganizationFinalizationStatusTone {
  if (finalized) {
    return "success";
  }
  if (notFinalized) {
    return "warning";
  }
  if (error || unsupported) {
    return "muted";
  }
  return "muted";
}
