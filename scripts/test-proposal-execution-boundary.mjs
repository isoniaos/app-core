import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/proposal-execution-boundary-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);

await rm(cacheRootPath, { force: true, recursive: true });

await transpileModule(
  new URL(
    "../src/features/proposals/proposal-execution-boundary.ts",
    import.meta.url,
  ),
  "src/features/proposals/proposal-execution-boundary.mjs",
);

const FINAL_TARGET = "0x1111111111111111111111111111111111111111";
const RECEIPT_FINAL_TARGET = "0x3333333333333333333333333333333333333333";
const MANAGED_EXECUTOR = "0x2222222222222222222222222222222222222222";
const OTHER_TARGET = "0x4444444444444444444444444444444444444444";
const ACTION_SELECTOR = "0xA1B2C3D4";
const RECEIPT_ACTION_SELECTOR = "0xDEADBEEF";
const OTHER_SELECTOR = "0x12345678";
const VALUE = "42";

try {
  const executionBoundary = await importCacheModule(
    "src/features/proposals/proposal-execution-boundary.mjs",
  );
  const {
    getExecutionPermissionNotice,
    getPermissionActionIdentity,
    sameAddress,
    sameSelector,
  } = executionBoundary;

  assertManagedExecutionUsesFinalTarget(getPermissionActionIdentity);
  assertReceiptFinalTargetFallback(getPermissionActionIdentity);
  assertDirectExecutionIdentity(getPermissionActionIdentity);
  assertPermissionRegistryUnavailable(getExecutionPermissionNotice);
  assertTargetNotConfigured(getExecutionPermissionNotice);
  assertTargetDisabled(getExecutionPermissionNotice);
  assertValueAboveLimit(getExecutionPermissionNotice);
  assertValueComparisonUnavailable(getExecutionPermissionNotice);
  assertSelectorUnavailable(getExecutionPermissionNotice);
  assertSelectorNotConfigured(getExecutionPermissionNotice);
  assertSelectorDisabled(getExecutionPermissionNotice);
  assertSuccessPath(getExecutionPermissionNotice);
  assertCaseInsensitiveMatching({ sameAddress, sameSelector });
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Proposal execution boundary tests passed from ${scriptDir}.`);

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

function assertManagedExecutionUsesFinalTarget(getPermissionActionIdentity) {
  const proposal = proposalFixture({
    actionSelector: ACTION_SELECTOR,
    executionReceipt: {
      actionSelector: RECEIPT_ACTION_SELECTOR,
      managedExecutorAddress: MANAGED_EXECUTOR,
      targetAddress: FINAL_TARGET,
    },
    managedExecutorAddress: MANAGED_EXECUTOR,
    targetAddress: FINAL_TARGET,
    value: VALUE,
  });
  const identity = getPermissionActionIdentity(proposal);

  assert.equal(identity.targetAddress, FINAL_TARGET);
  assert.notEqual(identity.targetAddress, proposal.managedExecutorAddress);
  assert.equal(identity.actionSelector, ACTION_SELECTOR);
  assert.equal(identity.value, proposal.value);
  assert.match(identity.source, /receipt final target used only as fallback/i);
  assert.match(identity.source, /managed executor ignored/i);
}

function assertReceiptFinalTargetFallback(getPermissionActionIdentity) {
  const receiptOnlyProposal = proposalFixture({
    actionSelector: undefined,
    executionReceipt: {
      actionSelector: RECEIPT_ACTION_SELECTOR,
      managedExecutorAddress: MANAGED_EXECUTOR,
      targetAddress: RECEIPT_FINAL_TARGET,
    },
    managedExecutorAddress: MANAGED_EXECUTOR,
    targetAddress: undefined,
    value: VALUE,
  });
  const receiptOnlyIdentity = getPermissionActionIdentity(receiptOnlyProposal);

  assert.equal(receiptOnlyIdentity.targetAddress, RECEIPT_FINAL_TARGET);
  assert.notEqual(receiptOnlyIdentity.targetAddress, MANAGED_EXECUTOR);
  assert.equal(receiptOnlyIdentity.actionSelector, RECEIPT_ACTION_SELECTOR);

  const proposalSelectorIdentity = getPermissionActionIdentity(
    proposalFixture({
      actionSelector: ACTION_SELECTOR,
      executionReceipt: {
        actionSelector: RECEIPT_ACTION_SELECTOR,
        managedExecutorAddress: MANAGED_EXECUTOR,
        targetAddress: RECEIPT_FINAL_TARGET,
      },
      managedExecutorAddress: MANAGED_EXECUTOR,
      targetAddress: undefined,
      value: VALUE,
    }),
  );

  assert.equal(proposalSelectorIdentity.targetAddress, RECEIPT_FINAL_TARGET);
  assert.equal(proposalSelectorIdentity.actionSelector, ACTION_SELECTOR);
}

function assertDirectExecutionIdentity(getPermissionActionIdentity) {
  const proposal = proposalFixture({
    actionSelector: ACTION_SELECTOR,
    targetAddress: FINAL_TARGET,
    value: VALUE,
  });
  const identity = getPermissionActionIdentity(proposal);

  assert.equal(identity.targetAddress, FINAL_TARGET);
  assert.equal(identity.actionSelector, ACTION_SELECTOR);
  assert.equal(identity.value, VALUE);
  assert.equal(Object.hasOwn(identity, "managedExecutorAddress"), false);
}

function assertPermissionRegistryUnavailable(getExecutionPermissionNotice) {
  const identity = identityFixture();
  const notice = getExecutionPermissionNotice({
    identity,
    permissions: undefined,
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Registry unavailable");
  assert.equal(notice.tone, "warning");
  assert.equal(notice.inlineTone, "warning");
  assertReadModelScopedWithoutImpossibleClaim(notice.message);

  const notFoundError = new Error("Execution permissions endpoint missing.");
  Object.defineProperty(notFoundError, "status", {
    value: 404,
  });
  const notFoundNotice = getExecutionPermissionNotice({
    identity,
    permissions: undefined,
    permissionsError: notFoundError,
  });

  assert.equal(notFoundNotice.label, "Registry unavailable");
  assert.equal(notFoundNotice.tone, "warning");
  assertReadModelScopedWithoutImpossibleClaim(notFoundNotice.message);
}

function assertTargetNotConfigured(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture(),
    permissions: permissionsFixture({
      targets: [targetFixture({ targetAddress: OTHER_TARGET })],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Target not configured");
  assert.equal(notice.tone, "warning");
  assert.match(notice.message, /No target rule was returned/i);
  assert.doesNotMatch(notice.message, /provider|block explorer|customer ABI/i);
}

function assertTargetDisabled(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture(),
    permissions: permissionsFixture({
      targets: [targetFixture({ enabled: false })],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Target disabled");
  assert.equal(notice.tone, "danger");
  assert.match(notice.message, /contract remains authoritative/i);
}

function assertValueAboveLimit(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture({ value: "100" }),
    permissions: permissionsFixture({
      targets: [targetFixture({ maxValue: "10" })],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Value above limit");
  assert.equal(notice.tone, "danger");
  assert.match(notice.message, /may be blocked by protocol checks/i);
  assert.doesNotMatch(notice.message, /App Core (blocks|blocked)/i);
}

function assertValueComparisonUnavailable(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture({ value: "not-a-number" }),
    permissions: permissionsFixture({
      targets: [targetFixture({ maxValue: "10" })],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Check value");
  assert.equal(notice.tone, "warning");
  assert.match(notice.message, /could not compare/i);
}

function assertSelectorUnavailable(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: { ...identityFixture(), actionSelector: undefined },
    permissions: permissionsFixture(),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Selector unavailable");
  assert.equal(notice.tone, "warning");
  assert.match(notice.message, /will not infer it from dataHash/i);
  assert.match(notice.message, /parse calldata/i);
  assert.match(notice.message, /ABI method name/i);
}

function assertSelectorNotConfigured(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture(),
    permissions: permissionsFixture({
      targets: [
        targetFixture({
          selectors: [selectorFixture({ selector: OTHER_SELECTOR })],
        }),
      ],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Selector not configured");
  assert.equal(notice.tone, "warning");
  assert.match(notice.message, /No selector rule was returned/i);
  assert.match(notice.message, /protocol-declared action selector/i);
}

function assertSelectorDisabled(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture(),
    permissions: permissionsFixture({
      targets: [
        targetFixture({
          selectors: [selectorFixture({ enabled: false })],
        }),
      ],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Selector disabled");
  assert.equal(notice.tone, "danger");
  assert.match(notice.message, /may be blocked by protocol checks/i);
}

function assertSuccessPath(getExecutionPermissionNotice) {
  const notice = getExecutionPermissionNotice({
    identity: identityFixture({ value: "9" }),
    permissions: permissionsFixture({
      targets: [targetFixture({ maxValue: "10" })],
    }),
    permissionsError: undefined,
  });

  assert.equal(notice.label, "Target and selector enabled");
  assert.equal(notice.tone, "success");
  assert.match(notice.message, /does not prove execution will succeed/i);
  assert.match(notice.message, /contracts remain authoritative/i);
}

function assertCaseInsensitiveMatching({ sameAddress, sameSelector }) {
  assert.equal(sameAddress("0xAbCdEf", "0xabcdef"), true);
  assert.equal(sameAddress("0xAbCdEf", "0x123456"), false);
  assert.equal(sameSelector("0xA1B2C3D4", "0xa1b2c3d4"), true);
  assert.equal(sameSelector("0xA1B2C3D4", "0x12345678"), false);
}

function proposalFixture({
  actionSelector,
  executionReceipt,
  managedExecutorAddress,
  targetAddress,
  value = VALUE,
} = {}) {
  return {
    actionSelector,
    executionReceipt,
    managedExecutorAddress,
    targetAddress,
    value,
  };
}

function identityFixture({
  actionSelector = ACTION_SELECTOR,
  targetAddress = FINAL_TARGET,
  value = VALUE,
} = {}) {
  return {
    actionSelector,
    source: "test identity",
    targetAddress,
    value,
  };
}

function permissionsFixture({ targets = [targetFixture()] } = {}) {
  return {
    targets,
  };
}

function targetFixture({
  enabled = true,
  maxValue = "100",
  selectors = [selectorFixture()],
  targetAddress = FINAL_TARGET,
} = {}) {
  return {
    enabled,
    maxValue,
    selectors,
    targetAddress,
  };
}

function selectorFixture({
  enabled = true,
  selector = ACTION_SELECTOR,
} = {}) {
  return {
    enabled,
    selector,
  };
}

function assertReadModelScopedWithoutImpossibleClaim(message) {
  assert.match(message, /read[- ]?models?/i);
  assert.doesNotMatch(message, /impossible|cannot execute|App Core blocks/i);
}
