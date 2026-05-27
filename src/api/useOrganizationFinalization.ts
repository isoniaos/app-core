import { useEffect, useMemo, useState } from "react";
import type { OrganizationFinalizationReadModelDto } from "@isonia/types";
import { useIsoniaClient } from "./IsoniaClientProvider";
import {
  deriveOrganizationFinalizationState,
  type OrganizationFinalizationDerivedState,
} from "./organization-finalization";
import {
  type IsoniaQueryState,
  useIsoniaQuery,
} from "./useIsoniaQuery";

export interface OrganizationFinalizationQuery
  extends IsoniaQueryState<OrganizationFinalizationReadModelDto>,
    OrganizationFinalizationDerivedState {}

const ORGANIZATION_FINALIZATION_CHANGED_EVENT =
  "isonia:organization-finalization-changed";

const finalizedOrgIdOverrides = new Set<string>();

interface OrganizationFinalizationChangedEventDetail {
  readonly finalized?: boolean;
  readonly orgId: string;
}

export function markOrganizationFinalized(orgId: string): void {
  finalizedOrgIdOverrides.add(orgId);
  dispatchOrganizationFinalizationChanged({ finalized: true, orgId });
}

export function useOrganizationFinalization(
  orgId: string,
): OrganizationFinalizationQuery {
  const client = useIsoniaClient();
  const [revision, setRevision] = useState(0);
  const query = useIsoniaQuery(
    () => client.organizationFinalization.get(orgId),
    [client, orgId],
  );
  const reloadFinalization = query.reload;
  const finalizedOverride = finalizedOrgIdOverrides.has(orgId);
  const derived = useMemo(
    () => {
      const base = deriveOrganizationFinalizationState({
        data: query.data,
        error: query.error,
        loading: query.loading,
        orgId,
      });

      if (!finalizedOverride) {
        return base;
      }

      return {
        ...base,
        finalized: true,
        notFinalized: false,
        statusCopy:
          "Bootstrap admin mutations are closed. Indexed governance remains readable.",
        statusLabel: "Finalized",
        statusTone: "success" as const,
        unknown: false,
      };
    },
    [finalizedOverride, orgId, query.data, query.error, query.loading, revision],
  );

  useEffect(() => {
    const handleFinalizationChanged = (event: Event): void => {
      const detail = getOrganizationFinalizationChangedEventDetail(event);
      if (!detail || detail.orgId !== orgId) {
        return;
      }

      if (detail.finalized) {
        finalizedOrgIdOverrides.add(orgId);
      }
      setRevision((value) => value + 1);
      reloadFinalization();
    };

    window.addEventListener(
      ORGANIZATION_FINALIZATION_CHANGED_EVENT,
      handleFinalizationChanged,
    );

    return () => {
      window.removeEventListener(
        ORGANIZATION_FINALIZATION_CHANGED_EVENT,
        handleFinalizationChanged,
      );
    };
  }, [orgId, reloadFinalization]);

  return {
    ...query,
    ...derived,
  };
}

function dispatchOrganizationFinalizationChanged(
  detail: OrganizationFinalizationChangedEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OrganizationFinalizationChangedEventDetail>(
      ORGANIZATION_FINALIZATION_CHANGED_EVENT,
      { detail },
    ),
  );
}

function getOrganizationFinalizationChangedEventDetail(
  event: Event,
): OrganizationFinalizationChangedEventDetail | undefined {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }

  const detail = event.detail as Partial<OrganizationFinalizationChangedEventDetail>;
  return typeof detail.orgId === "string"
    ? {
        finalized: detail.finalized,
        orgId: detail.orgId,
      }
    : undefined;
}
