import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encodeErrorResult } from "viem";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/contract-error-decoder-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);

await rm(cacheRootPath, { force: true, recursive: true });

try {
  await transpileModule(
    new URL("../src/chain/protocol-errors.ts", import.meta.url),
    "src/chain/protocol-errors.mjs",
  );
  await transpileModule(
    new URL("../src/chain/contract-error-decoder.ts", import.meta.url),
    "src/chain/contract-error-decoder.mjs",
    (source) =>
      source.replace(
        'from "./protocol-errors";',
        'from "./protocol-errors.mjs";',
      ),
  );
  await transpileModule(
    new URL("../src/chain/proposal-contracts.ts", import.meta.url),
    "src/chain/proposal-contracts.mjs",
    (source) =>
      source.replace(
        'from "./protocol-errors";',
        'from "./protocol-errors.mjs";',
      ),
  );

  const { ISONIA_PROTOCOL_ERROR_ABI } = await importCacheModule(
    "src/chain/protocol-errors.mjs",
  );
  const { formatDecodedContractError, getErrorMessage } = await importCacheModule(
    "src/chain/contract-error-decoder.mjs",
  );
  const { ISO_PROPOSALS_ABI } = await importCacheModule(
    "src/chain/proposal-contracts.mjs",
  );

  assertCreateProposalAbiCarriesActionSelector(ISO_PROPOSALS_ABI);
  assertCustomProtocolErrorDecoded({
    abi: ISONIA_PROTOCOL_ERROR_ABI,
    formatDecodedContractError,
  });
  assertNestedExecutionErrorDecoded({
    abi: ISONIA_PROTOCOL_ERROR_ABI,
    formatDecodedContractError,
  });
  assertDataHashIsNotTreatedAsErrorData({
    formatDecodedContractError,
  });
  assertShortMessagePreferred(getErrorMessage);
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Contract error decoder tests passed from ${scriptDir}.`);

async function transpileModule(sourcePath, outputPath, transform = (source) => source) {
  const source = transform(await readFile(sourcePath, "utf8"));
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

function assertCustomProtocolErrorDecoded({ abi, formatDecodedContractError }) {
  const data = encodeErrorResult({
    abi,
    errorName: "PolicyRuleNotEnabled",
    args: [1n, 1],
  });
  const decoded = formatDecodedContractError({ data });

  assert.equal(decoded, "PolicyRuleNotEnabled(orgId: 1, proposalType: 1)");
}

function assertCreateProposalAbiCarriesActionSelector(abi) {
  const createProposal = abi.find(
    (item) => item.type === "function" && item.name === "createProposal",
  );

  assert.ok(createProposal, "createProposal ABI entry should exist.");
  assert.deepEqual(
    createProposal.inputs.map((input) => input.name),
    [
      "orgId",
      "proposalType",
      "target",
      "value",
      "actionSelector",
      "dataHash",
      "metadataURI",
    ],
  );
}

function assertNestedExecutionErrorDecoded({ abi, formatDecodedContractError }) {
  const nested = encodeErrorResult({
    abi,
    errorName: "Unauthorized",
    args: ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
  });
  const data = encodeErrorResult({
    abi,
    errorName: "ExecutionFailed",
    args: [nested],
  });
  const decoded = formatDecodedContractError({ cause: { data } });

  assert.match(decoded, /^ExecutionFailed\(reason: 0x/);
  assert.match(
    decoded,
    /nested error: Unauthorized\(actor: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\)/,
  );
}

function assertDataHashIsNotTreatedAsErrorData({ formatDecodedContractError }) {
  const hash = `0x${"1".repeat(64)}`;

  assert.equal(
    formatDecodedContractError(new Error(`Generated data hash ${hash} did not match.`)),
    undefined,
  );
}

function assertShortMessagePreferred(getErrorMessage) {
  assert.equal(
    getErrorMessage({
      message: "Verbose message",
      shortMessage: "Short message",
    }),
    "Short message",
  );
}
