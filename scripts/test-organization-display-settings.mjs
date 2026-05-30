import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/organization-display-settings-tests/",
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
    new URL(
      "../src/features/organization-settings/organization-display-settings.ts",
      import.meta.url,
    ),
    "src/features/organization-settings/organization-display-settings.mjs",
  );

  const storageModule = await importCacheModule(
    "src/features/organization-settings/organization-display-settings.mjs",
  );
  const {
    clearOrganizationDisplayNameOverride,
    parseOrganizationDisplaySettingsStore,
    readOrganizationDisplaySettings,
    setOrganizationDisplayNameOverride,
  } = storageModule;

  assertParseFiltersInvalidRecords(parseOrganizationDisplaySettingsStore);
  assertSetReadClearAndStableSnapshots({
    clearOrganizationDisplayNameOverride,
    readOrganizationDisplaySettings,
    setOrganizationDisplayNameOverride,
  });
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Organization display settings tests passed from ${scriptDir}.`);

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

function assertParseFiltersInvalidRecords(parseOrganizationDisplaySettingsStore) {
  const store = parseOrganizationDisplaySettingsStore({
    records: {
      "1": { displayName: "  Treasury council  " },
      "2": { displayName: "" },
      "3": { displayName: 123 },
      "4": null,
    },
  });

  assert.deepEqual(Object.keys(store.records), ["1"]);
  assert.equal(store.records["1"].displayName, "Treasury council");
}

function assertSetReadClearAndStableSnapshots({
  clearOrganizationDisplayNameOverride,
  readOrganizationDisplaySettings,
  setOrganizationDisplayNameOverride,
}) {
  const storage = new MemoryStorage();

  const missing = readOrganizationDisplaySettings("1", storage);
  assert.strictEqual(readOrganizationDisplaySettings("1", storage), missing);

  const firstSet = setOrganizationDisplayNameOverride(
    "1",
    "  Operations DAO  ",
    storage,
  );
  assert.equal(firstSet, "Operations DAO");

  const firstRead = readOrganizationDisplaySettings("1", storage);
  assert.equal(firstRead.displayName, "Operations DAO");
  assert.strictEqual(readOrganizationDisplaySettings("1", storage), firstRead);

  const secondSet = setOrganizationDisplayNameOverride("1", "Core council", storage);
  assert.equal(secondSet, "Core council");

  const secondRead = readOrganizationDisplaySettings("1", storage);
  assert.equal(secondRead.displayName, "Core council");
  assert.notStrictEqual(secondRead, firstRead);
  assert.strictEqual(readOrganizationDisplaySettings("1", storage), secondRead);

  clearOrganizationDisplayNameOverride("1", storage);
  const cleared = readOrganizationDisplaySettings("1", storage);
  assert.equal(cleared.displayName, undefined);
  assert.strictEqual(readOrganizationDisplaySettings("1", storage), cleared);
}
