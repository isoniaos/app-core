import { useCallback, useSyncExternalStore } from "react";
import type { Address } from "@isonia/types";
import { isAddress } from "viem";

export interface KnownContractRecord {
  readonly id: string;
  readonly orgId: string;
  readonly chainId: number;
  readonly name: string;
  readonly address: Address;
  readonly abiJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnownContractDraft {
  readonly id?: string;
  readonly orgId: string;
  readonly chainId: number;
  readonly name: string;
  readonly address: string;
  readonly abiJson: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface KnownContractsStore {
  readonly records: readonly KnownContractRecord[];
}

const KNOWN_CONTRACTS_STORAGE_KEY = "isonia-known-contracts:v1";
const KNOWN_CONTRACTS_STORAGE_EVENT = "isonia-known-contracts-changed";
const EMPTY_KNOWN_CONTRACTS: readonly KnownContractRecord[] = Object.freeze([]);

let knownContractsStoreCache:
  | {
      readonly rawValue: string | null;
      readonly records: readonly KnownContractRecord[];
      readonly storage: StorageLike;
    }
  | undefined;

const knownContractsOrgChainCache = new Map<
  string,
  {
    readonly records: readonly KnownContractRecord[];
    readonly snapshot: readonly KnownContractRecord[];
  }
>();

export function readKnownContracts(
  storage: StorageLike | undefined = getBrowserStorage(),
): readonly KnownContractRecord[] {
  if (!storage) {
    return EMPTY_KNOWN_CONTRACTS;
  }

  const rawValue = storage.getItem(KNOWN_CONTRACTS_STORAGE_KEY);
  if (
    knownContractsStoreCache?.storage === storage &&
    knownContractsStoreCache.rawValue === rawValue
  ) {
    return knownContractsStoreCache.records;
  }

  try {
    const records = withStableEmptyKnownContracts(
      parseKnownContractsStore(JSON.parse(rawValue ?? "{}")).records,
    );
    knownContractsStoreCache = { rawValue, records, storage };
    return records;
  } catch {
    knownContractsStoreCache = {
      rawValue,
      records: EMPTY_KNOWN_CONTRACTS,
      storage,
    };
    return EMPTY_KNOWN_CONTRACTS;
  }
}

export function getKnownContractsForOrgChain({
  chainId,
  orgId,
  storage = getBrowserStorage(),
}: {
  readonly chainId: number;
  readonly orgId: string;
  readonly storage?: StorageLike;
}): readonly KnownContractRecord[] {
  return readKnownContracts(storage)
    .filter((record) => record.orgId === orgId && record.chainId === chainId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getKnownContractsSnapshotForOrgChain({
  chainId,
  orgId,
  storage = getBrowserStorage(),
}: {
  readonly chainId: number;
  readonly orgId: string;
  readonly storage?: StorageLike;
}): readonly KnownContractRecord[] {
  const records = readKnownContracts(storage);
  const cacheKey = `${orgId}:${chainId}`;
  const cached = knownContractsOrgChainCache.get(cacheKey);
  if (cached?.records === records) {
    return cached.snapshot;
  }

  const snapshot = withStableEmptyKnownContracts(
    records
      .filter((record) => record.orgId === orgId && record.chainId === chainId)
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
  knownContractsOrgChainCache.set(cacheKey, { records, snapshot });
  return snapshot;
}

export function saveKnownContract(
  draft: KnownContractDraft,
  options: {
    readonly now?: string;
    readonly storage?: StorageLike;
  } = {},
): KnownContractRecord | Error {
  const storage = options.storage ?? getBrowserStorage();
  if (!storage) {
    return new Error("Browser storage is unavailable.");
  }

  const name = draft.name.trim();
  if (!name) {
    return new Error("Contract name is required.");
  }

  if (!isAddress(draft.address)) {
    return new Error("Contract address must be a valid EVM address.");
  }

  const now = options.now ?? new Date().toISOString();
  const records = [...readKnownContracts(storage)];
  const existing = draft.id
    ? records.find((record) => record.id === draft.id)
    : undefined;
  const record: KnownContractRecord = {
    abiJson: draft.abiJson.trim(),
    address: draft.address as Address,
    chainId: draft.chainId,
    createdAt: existing?.createdAt ?? now,
    id: draft.id ?? createRecordId(draft.orgId, draft.chainId),
    name,
    orgId: draft.orgId,
    updatedAt: now,
  };
  const next = existing
    ? records.map((item) => (item.id === existing.id ? record : item))
    : [...records, record];

  writeKnownContracts(storage, next);
  dispatchKnownContractsChanged();

  return record;
}

export function deleteKnownContract(
  id: string,
  storage: StorageLike | undefined = getBrowserStorage(),
): void {
  if (!storage) {
    return;
  }

  writeKnownContracts(
    storage,
    readKnownContracts(storage).filter((record) => record.id !== id),
  );
  dispatchKnownContractsChanged();
}

export function useKnownContracts(
  orgId: string,
  chainId: number,
): {
  readonly contracts: readonly KnownContractRecord[];
  readonly deleteContract: (id: string) => void;
  readonly saveContract: (draft: KnownContractDraft) => KnownContractRecord | Error;
} {
  const snapshot = useSyncExternalStore(
    subscribeKnownContracts,
    () => getKnownContractsSnapshotForOrgChain({ chainId, orgId }),
    getEmptyKnownContractsSnapshot,
  );
  const saveContract = useCallback(
    (draft: KnownContractDraft) =>
      saveKnownContract({ ...draft, chainId, orgId }),
    [chainId, orgId],
  );
  const deleteContract = useCallback((id: string) => {
    deleteKnownContract(id);
  }, []);

  return { contracts: snapshot, deleteContract, saveContract };
}

export function parseKnownContractsStore(value: unknown): KnownContractsStore {
  if (!value || typeof value !== "object") {
    return { records: [] };
  }

  const record = value as Record<string, unknown>;
  const records = Array.isArray(record.records)
    ? record.records.flatMap(readKnownContractRecord)
    : [];

  return { records };
}

function readKnownContractRecord(value: unknown): KnownContractRecord[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.orgId !== "string" ||
    typeof record.chainId !== "number" ||
    typeof record.name !== "string" ||
    typeof record.address !== "string" ||
    typeof record.abiJson !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    !isAddress(record.address)
  ) {
    return [];
  }

  return [
    {
      abiJson: record.abiJson,
      address: record.address as Address,
      chainId: record.chainId,
      createdAt: record.createdAt,
      id: record.id,
      name: record.name,
      orgId: record.orgId,
      updatedAt: record.updatedAt,
    },
  ];
}

function writeKnownContracts(
  storage: StorageLike,
  records: readonly KnownContractRecord[],
): void {
  const stableRecords = withStableEmptyKnownContracts(records);
  const rawValue = JSON.stringify({ records: stableRecords }, null, 2);
  storage.setItem(KNOWN_CONTRACTS_STORAGE_KEY, rawValue);
  knownContractsStoreCache = { rawValue, records: stableRecords, storage };
}

function subscribeKnownContracts(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key === KNOWN_CONTRACTS_STORAGE_KEY) {
      listener();
    }
  };
  const onLocalChange = (): void => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(KNOWN_CONTRACTS_STORAGE_EVENT, onLocalChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(KNOWN_CONTRACTS_STORAGE_EVENT, onLocalChange);
  };
}

function dispatchKnownContractsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(KNOWN_CONTRACTS_STORAGE_EVENT));
  }
}

function getEmptyKnownContractsSnapshot(): readonly KnownContractRecord[] {
  return EMPTY_KNOWN_CONTRACTS;
}

function withStableEmptyKnownContracts(
  records: readonly KnownContractRecord[],
): readonly KnownContractRecord[] {
  return records.length > 0 ? records : EMPTY_KNOWN_CONTRACTS;
}

function createRecordId(orgId: string, chainId: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${orgId}:${chainId}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
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
