import { useCallback, useSyncExternalStore } from "react";

export interface OrganizationDisplaySettings {
  readonly displayName?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface OrganizationDisplaySettingsStore {
  readonly records: Record<string, OrganizationDisplaySettings>;
}

const ORGANIZATION_DISPLAY_STORAGE_KEY = "isonia-organization-display:v1";
const ORGANIZATION_DISPLAY_STORAGE_EVENT = "isonia-organization-display-changed";
const EMPTY_ORGANIZATION_DISPLAY_SETTINGS: OrganizationDisplaySettings =
  Object.freeze({});
const EMPTY_ORGANIZATION_DISPLAY_STORE: OrganizationDisplaySettingsStore =
  Object.freeze({ records: Object.freeze({}) });

let organizationDisplayStoreCache:
  | {
      readonly rawValue: string | null;
      readonly storage: StorageLike;
      readonly store: OrganizationDisplaySettingsStore;
    }
  | undefined;

export function useOrganizationDisplaySettings(
  orgId: string | undefined,
): {
  readonly displayNameOverride: string | undefined;
  readonly clearDisplayNameOverride: () => void;
  readonly setDisplayNameOverride: (value: string) => string | Error;
} {
  const snapshot = useSyncExternalStore(
    subscribeOrganizationDisplaySettings,
    () =>
      orgId
        ? readOrganizationDisplaySettings(orgId)
        : EMPTY_ORGANIZATION_DISPLAY_SETTINGS,
    getEmptyOrganizationDisplaySettingsSnapshot,
  );
  const setDisplayNameOverride = useCallback(
    (value: string): string | Error => {
      if (!orgId) {
        return new Error("Organization ID is unavailable.");
      }
      return setOrganizationDisplayNameOverride(orgId, value);
    },
    [orgId],
  );
  const clearDisplayNameOverride = useCallback(() => {
    if (orgId) {
      clearOrganizationDisplayNameOverride(orgId);
    }
  }, [orgId]);

  return {
    clearDisplayNameOverride,
    displayNameOverride: snapshot.displayName,
    setDisplayNameOverride,
  };
}

export function readOrganizationDisplaySettings(
  orgId: string,
  storage: StorageLike | undefined = getBrowserStorage(),
): OrganizationDisplaySettings {
  if (!storage) {
    return EMPTY_ORGANIZATION_DISPLAY_SETTINGS;
  }

  return (
    readOrganizationDisplaySettingsStore(storage).records[orgId] ??
    EMPTY_ORGANIZATION_DISPLAY_SETTINGS
  );
}

export function setOrganizationDisplayNameOverride(
  orgId: string,
  value: string,
  storage: StorageLike | undefined = getBrowserStorage(),
): string | Error {
  const name = value.trim();
  if (!name) {
    return new Error("Display name cannot be empty.");
  }

  if (!storage) {
    return new Error("Browser storage is unavailable.");
  }

  const store = readOrganizationDisplaySettingsStore(storage);
  writeOrganizationDisplaySettingsStore(storage, {
    records: {
      ...store.records,
      [orgId]: { displayName: name },
    },
  });
  dispatchOrganizationDisplaySettingsChanged();

  return name;
}

export function clearOrganizationDisplayNameOverride(
  orgId: string,
  storage: StorageLike | undefined = getBrowserStorage(),
): void {
  if (!storage) {
    return;
  }

  const store = readOrganizationDisplaySettingsStore(storage);
  const nextRecords = { ...store.records };
  delete nextRecords[orgId];
  writeOrganizationDisplaySettingsStore(storage, { records: nextRecords });
  dispatchOrganizationDisplaySettingsChanged();
}

export function parseOrganizationDisplaySettingsStore(
  value: unknown,
): OrganizationDisplaySettingsStore {
  if (!value || typeof value !== "object") {
    return { records: {} };
  }

  const rawRecords = (value as Record<string, unknown>).records;
  if (!rawRecords || typeof rawRecords !== "object" || Array.isArray(rawRecords)) {
    return { records: {} };
  }

  const records: Record<string, OrganizationDisplaySettings> = {};
  for (const [orgId, rawSettings] of Object.entries(rawRecords)) {
    if (!rawSettings || typeof rawSettings !== "object") {
      continue;
    }

    const displayName = (rawSettings as Record<string, unknown>).displayName;
    if (typeof displayName === "string" && displayName.trim().length > 0) {
      records[orgId] = { displayName: displayName.trim() };
    }
  }

  return { records };
}

function readOrganizationDisplaySettingsStore(
  storage: StorageLike,
): OrganizationDisplaySettingsStore {
  const rawValue = storage.getItem(ORGANIZATION_DISPLAY_STORAGE_KEY);
  if (
    organizationDisplayStoreCache?.storage === storage &&
    organizationDisplayStoreCache.rawValue === rawValue
  ) {
    return organizationDisplayStoreCache.store;
  }

  try {
    const store = parseOrganizationDisplaySettingsStore(
      JSON.parse(rawValue ?? "{}"),
    );
    organizationDisplayStoreCache = { rawValue, storage, store };
    return store;
  } catch {
    organizationDisplayStoreCache = {
      rawValue,
      storage,
      store: EMPTY_ORGANIZATION_DISPLAY_STORE,
    };
    return EMPTY_ORGANIZATION_DISPLAY_STORE;
  }
}

function writeOrganizationDisplaySettingsStore(
  storage: StorageLike,
  store: OrganizationDisplaySettingsStore,
): void {
  const rawValue = JSON.stringify(store, null, 2);
  storage.setItem(ORGANIZATION_DISPLAY_STORAGE_KEY, rawValue);
  organizationDisplayStoreCache = { rawValue, storage, store };
}

function subscribeOrganizationDisplaySettings(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key === ORGANIZATION_DISPLAY_STORAGE_KEY) {
      listener();
    }
  };
  const onLocalChange = (): void => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(ORGANIZATION_DISPLAY_STORAGE_EVENT, onLocalChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ORGANIZATION_DISPLAY_STORAGE_EVENT, onLocalChange);
  };
}

function dispatchOrganizationDisplaySettingsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ORGANIZATION_DISPLAY_STORAGE_EVENT));
  }
}

function getEmptyOrganizationDisplaySettingsSnapshot(): OrganizationDisplaySettings {
  return EMPTY_ORGANIZATION_DISPLAY_SETTINGS;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
