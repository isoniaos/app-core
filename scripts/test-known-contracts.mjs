import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/known-contracts-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

await rm(cacheRootPath, { force: true, recursive: true });

try {
  await transpileModule(
    new URL("../src/features/known-contracts/known-contracts-storage.ts", import.meta.url),
    "src/features/known-contracts/known-contracts-storage.mjs",
  );

  const storageModule = await importCacheModule(
    "src/features/known-contracts/known-contracts-storage.mjs",
  );
  const {
    getKnownContractsForOrgChain,
    getKnownContractsSnapshotForOrgChain,
    parseKnownContractsStore,
    readKnownContracts,
    saveKnownContract,
    deleteKnownContract,
  } = storageModule;

  assertParseFiltersInvalidRecords(parseKnownContractsStore);
  assertSaveReadFilterAndDelete({
    deleteKnownContract,
    getKnownContractsForOrgChain,
    getKnownContractsSnapshotForOrgChain,
    readKnownContracts,
    saveKnownContract,
  });
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Known contract storage tests passed from ${scriptDir}.`);

async function transpileModule(sourcePath, outputPath) {
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileURLToPath(sourcePath),
  });
  const outputUrl = new URL(outputPath, cacheRootUrl);

  await mkdir(dirname(fileURLToPath(outputUrl)), { recursive: true });
  await writeFile(outputUrl, transpiled.outputText, "utf8");
}

async function importCacheModule(outputPath) {
  const outputUrl = new URL(outputPath, cacheRootUrl);
  return import(`${pathToFileURL(fileURLToPath(outputUrl)).href}?t=${Date.now()}`);
}

function assertParseFiltersInvalidRecords(parseKnownContractsStore) {
  const store = parseKnownContractsStore({
    records: [
      {
        abiJson: "[]",
        address: "0x0000000000000000000000000000000000000001",
        chainId: 31337,
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "valid",
        name: "Valid",
        orgId: "1",
        updatedAt: "2026-05-30T00:00:00.000Z",
      },
      {
        abiJson: "[]",
        address: "not-an-address",
        chainId: 31337,
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "invalid",
        name: "Invalid",
        orgId: "1",
        updatedAt: "2026-05-30T00:00:00.000Z",
      },
    ],
  });

  assert.equal(store.records.length, 1);
  assert.equal(store.records[0].id, "valid");
}

function assertSaveReadFilterAndDelete({
  deleteKnownContract,
  getKnownContractsForOrgChain,
  getKnownContractsSnapshotForOrgChain,
  readKnownContracts,
  saveKnownContract,
}) {
  const storage = new MemoryStorage();
  const abiJson = JSON.stringify([
    {
      type: "function",
      name: "setValue",
      stateMutability: "nonpayable",
      inputs: [{ name: "value", type: "uint256" }],
      outputs: [],
    },
  ]);

  const emptySnapshot = getKnownContractsSnapshotForOrgChain({
    chainId: 31337,
    orgId: "1",
    storage,
  });
  assert.strictEqual(
    getKnownContractsSnapshotForOrgChain({ chainId: 31337, orgId: "1", storage }),
    emptySnapshot,
  );

  const first = saveKnownContract(
    {
      abiJson,
      address: "0x0000000000000000000000000000000000000001",
      chainId: 31337,
      name: "Alpha",
      orgId: "1",
    },
    { now: "2026-05-30T00:00:00.000Z", storage },
  );
  const second = saveKnownContract(
    {
      abiJson,
      address: "0x0000000000000000000000000000000000000002",
      chainId: 1,
      name: "Mainnet",
      orgId: "1",
    },
    { now: "2026-05-30T00:00:00.000Z", storage },
  );
  const third = saveKnownContract(
    {
      abiJson,
      address: "0x0000000000000000000000000000000000000003",
      chainId: 31337,
      name: "Other org",
      orgId: "2",
    },
    { now: "2026-05-30T00:00:00.000Z", storage },
  );

  assert.equal(first instanceof Error, false);
  assert.equal(second instanceof Error, false);
  assert.equal(third instanceof Error, false);
  assert.equal(readKnownContracts(storage).length, 3);
  assert.strictEqual(readKnownContracts(storage), readKnownContracts(storage));

  const localOrgContracts = getKnownContractsForOrgChain({
    chainId: 31337,
    orgId: "1",
    storage,
  });
  const localOrgSnapshot = getKnownContractsSnapshotForOrgChain({
    chainId: 31337,
    orgId: "1",
    storage,
  });

  assert.equal(localOrgContracts.length, 1);
  assert.equal(localOrgContracts[0].name, "Alpha");
  assert.equal(localOrgContracts[0].chainId, 31337);
  assert.equal(localOrgContracts[0].orgId, "1");
  assert.strictEqual(
    getKnownContractsSnapshotForOrgChain({ chainId: 31337, orgId: "1", storage }),
    localOrgSnapshot,
  );

  const updated = saveKnownContract(
    {
      abiJson,
      address: "0x0000000000000000000000000000000000000004",
      chainId: 31337,
      id: localOrgContracts[0].id,
      name: "Alpha updated",
      orgId: "1",
    },
    { now: "2026-05-30T00:01:00.000Z", storage },
  );

  assert.equal(updated instanceof Error, false);
  assert.equal(readKnownContracts(storage).length, 3);
  assert.notStrictEqual(
    getKnownContractsSnapshotForOrgChain({ chainId: 31337, orgId: "1", storage }),
    localOrgSnapshot,
  );
  assert.equal(
    getKnownContractsForOrgChain({ chainId: 31337, orgId: "1", storage })[0]
      .name,
    "Alpha updated",
  );

  deleteKnownContract(localOrgContracts[0].id, storage);
  assert.equal(
    getKnownContractsForOrgChain({ chainId: 31337, orgId: "1", storage })
      .length,
    0,
  );
}
