import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/abi-proposal-builder-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);

await rm(cacheRootPath, { force: true, recursive: true });

try {
  await transpileModule(
    new URL("../src/features/known-contracts/abi/contract-abi.ts", import.meta.url),
    "src/features/known-contracts/abi/contract-abi.mjs",
  );

  const abiModule = await importCacheModule(
    "src/features/known-contracts/abi/contract-abi.mjs",
  );
  const {
    areAbiTypesCompatible,
    buildActionDataPreview,
    coerceAbiLiteral,
    getCompatibleReadResults,
    parseContractAbiJson,
    parseProposalActionValue,
  } = abiModule;

  assertAbiParsingAndClassification(parseContractAbiJson);
  assertOverloadedSignatures(parseContractAbiJson);
  assertInvalidAbiHandling(parseContractAbiJson);
  assertParameterCoercion(coerceAbiLiteral);
  assertReadResultCompatibility({
    areAbiTypesCompatible,
    getCompatibleReadResults,
  });
  assertActionDataAndHashGeneration({
    buildActionDataPreview,
    coerceAbiLiteral,
    parseContractAbiJson,
    parseProposalActionValue,
  });
  assertUnsupportedInputsRejected({
    coerceAbiLiteral,
    parseContractAbiJson,
  });
  await assertCopyAndVocabularyGuards();
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`ABI proposal builder tests passed from ${scriptDir}.`);

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

function assertAbiParsingAndClassification(parseContractAbiJson) {
  const parsed = parseContractAbiJson(JSON.stringify(testAbi()));

  assert.equal(parsed instanceof Error, false);
  assert.equal(parsed.functions.length, 8);
  assert.equal(parsed.readableCount, 2);
  assert.equal(parsed.writableCount, 6);
  assert.equal(parsed.functions.find((fn) => fn.signature === "number()").kind, "readable");
  assert.equal(
    parsed.functions.find((fn) => fn.signature === "setNumber(uint64,uint256)")
      .kind,
    "writable",
  );
  assert.equal(
    parsed.functions.find((fn) => fn.signature === "deposit(bytes32)").payable,
    true,
  );
}

function assertOverloadedSignatures(parseContractAbiJson) {
  const parsed = parseContractAbiJson(JSON.stringify(testAbi()));

  assert.equal(parsed instanceof Error, false);
  assert.ok(parsed.functions.some((fn) => fn.signature === "overloaded(uint256)"));
  assert.ok(parsed.functions.some((fn) => fn.signature === "overloaded(string)"));
}

function assertInvalidAbiHandling(parseContractAbiJson) {
  assert.equal(parseContractAbiJson("{bad json") instanceof Error, true);
  assert.equal(parseContractAbiJson(JSON.stringify({ abi: [] })) instanceof Error, true);
  assert.equal(parseContractAbiJson(JSON.stringify([])) instanceof Error, true);
}

function assertParameterCoercion(coerceAbiLiteral) {
  assert.equal(
    coerceAbiLiteral("address", "0x0000000000000000000000000000000000000001"),
    "0x0000000000000000000000000000000000000001",
  );
  assert.equal(coerceAbiLiteral("bool", "true"), true);
  assert.equal(coerceAbiLiteral("string", "hello"), "hello");
  assert.equal(coerceAbiLiteral("bytes", "0x1234"), "0x1234");
  assert.equal(
    coerceAbiLiteral("bytes32", `0x${"a".repeat(64)}`),
    `0x${"a".repeat(64)}`,
  );
  assert.equal(coerceAbiLiteral("uint64", "42"), 42n);
  assert.equal(coerceAbiLiteral("int256", "-42"), -42n);
  assert.equal(coerceAbiLiteral("uint256", "-1") instanceof Error, true);
  assert.equal(coerceAbiLiteral("bytes4", "0x123456") instanceof Error, true);
}

function assertReadResultCompatibility({
  areAbiTypesCompatible,
  getCompatibleReadResults,
}) {
  assert.equal(areAbiTypesCompatible("uint", "uint256"), true);
  assert.equal(areAbiTypesCompatible("uint64", "uint256"), false);
  assert.equal(areAbiTypesCompatible("bytes32", "bytes32"), true);

  const compatible = getCompatibleReadResults("uint256", [
    readResult("a", "uint256", 1n),
    readResult("b", "address", "0x0000000000000000000000000000000000000001"),
  ]);

  assert.deepEqual(compatible.map((result) => result.id), ["a"]);
}

function assertActionDataAndHashGeneration({
  buildActionDataPreview,
  coerceAbiLiteral,
  parseContractAbiJson,
  parseProposalActionValue,
}) {
  const parsed = parseContractAbiJson(JSON.stringify(testAbi()));
  assert.equal(parsed instanceof Error, false);

  const setNumber = parsed.functions.find(
    (fn) => fn.signature === "setNumber(uint64,uint256)",
  );
  const setFlag = parsed.functions.find((fn) => fn.signature === "setFlag(bool)");
  const deposit = parsed.functions.find((fn) => fn.signature === "deposit(bytes32)");
  const number = parsed.functions.find((fn) => fn.signature === "number()");

  const setNumberArgs = [
    coerceAbiLiteral("uint64", "1"),
    coerceAbiLiteral("uint256", "42"),
  ];
  assert.equal(setNumberArgs.every((arg) => !(arg instanceof Error)), true);

  const demoAction = buildActionDataPreview({ args: setNumberArgs, fn: setNumber });
  assert.equal(demoAction instanceof Error, false);
  assert.equal(demoAction.actionData.startsWith("0x"), true);
  assert.equal(demoAction.actionSelector, demoAction.actionData.slice(0, 10));
  assert.match(demoAction.dataHash, /^0x[a-fA-F0-9]{64}$/);

  const nonpayableAction = buildActionDataPreview({
    args: [coerceAbiLiteral("bool", "true")],
    fn: setFlag,
  });
  assert.equal(nonpayableAction instanceof Error, false);
  assert.equal(parseProposalActionValue(setFlag, "999"), 0n);

  const payableAction = buildActionDataPreview({
    args: [coerceAbiLiteral("bytes32", `0x${"b".repeat(64)}`)],
    fn: deposit,
  });
  assert.equal(payableAction instanceof Error, false);
  assert.equal(parseProposalActionValue(deposit, "5"), 5n);
  assert.equal(parseProposalActionValue(deposit, "-1") instanceof Error, true);
  assert.equal(buildActionDataPreview({ args: [], fn: number }) instanceof Error, true);
}

function assertUnsupportedInputsRejected({
  coerceAbiLiteral,
  parseContractAbiJson,
}) {
  const parsed = parseContractAbiJson(JSON.stringify(testAbi()));
  const unsupported = parsed.functions.find(
    (fn) => fn.signature === "setMany(uint256[])",
  );

  assert.equal(unsupported.supportedInputs, false);
  assert.deepEqual(unsupported.unsupportedInputTypes, ["uint256[]"]);
  assert.equal(coerceAbiLiteral("uint256[]", "[1]") instanceof Error, true);
}

async function assertCopyAndVocabularyGuards() {
  const files = [
    "../src/features/known-contracts/abi/contract-abi.ts",
    "../src/features/known-contracts/known-contracts-storage.ts",
    "../src/features/organization-settings/OrganizationSettingsPage.tsx",
    "../src/features/proposals/CreateProposalPage.tsx",
  ];
  const source = (
    await Promise.all(
      files.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
    )
  ).join("\n");

  assert.doesNotMatch(
    source,
    /GovCore|GovProposals|govCore|govProposals|GOV_CORE_ADDRESS|GOV_PROPOSALS_ADDRESS|govCoreAddress|govProposalsAddress/,
  );
  assert.doesNotMatch(
    source,
    /production ready|production readiness|audit ready|audit readiness|public beta ready|public beta readiness|legal ready|legal readiness|SaaS ready|SaaS readiness|provider complete|provider-complete|provider completeness|automatic external execution|external records as protocol authority|ABI labels are protocol authority|verified ABI/i,
  );
}

function readResult(id, type, value) {
  return {
    functionLabel: "read()",
    functionSignature: "read()",
    id,
    outputIndex: 0,
    type,
    value,
  };
}

function testAbi() {
  return [
    {
      type: "function",
      name: "number",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
    },
    {
      type: "function",
      name: "owner",
      stateMutability: "pure",
      inputs: [],
      outputs: [{ name: "account", type: "address" }],
    },
    {
      type: "function",
      name: "setNumber",
      stateMutability: "nonpayable",
      inputs: [
        { name: "orgId", type: "uint64" },
        { name: "newNumber", type: "uint256" },
      ],
      outputs: [],
    },
    {
      type: "function",
      name: "setFlag",
      stateMutability: "nonpayable",
      inputs: [{ name: "flag", type: "bool" }],
      outputs: [],
    },
    {
      type: "function",
      name: "deposit",
      stateMutability: "payable",
      inputs: [{ name: "salt", type: "bytes32" }],
      outputs: [],
    },
    {
      type: "function",
      name: "overloaded",
      stateMutability: "nonpayable",
      inputs: [{ name: "value", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "overloaded",
      stateMutability: "nonpayable",
      inputs: [{ name: "value", type: "string" }],
      outputs: [],
    },
    {
      type: "function",
      name: "setMany",
      stateMutability: "nonpayable",
      inputs: [{ name: "values", type: "uint256[]" }],
      outputs: [],
    },
  ];
}
