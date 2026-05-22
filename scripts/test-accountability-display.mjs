import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/accountability-display-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);

await rm(cacheRootPath, { force: true, recursive: true });

const sourceModules = [
  ["../src/utils/format.ts", "src/utils/format.mjs"],
  [
    "../src/features/accountability/accountability-display.ts",
    "src/features/accountability/accountability-display.mjs",
  ],
];

for (const [sourcePath, outputPath] of sourceModules) {
  await transpileModule(new URL(sourcePath, import.meta.url), outputPath);
}

try {
  const types = await import("@isonia/types");
  const { IsoniaApiError } = await import("@isonia/sdk");
  const display = await importCacheModule(
    "src/features/accountability/accountability-display.mjs",
  );

  const {
    AccountabilityExecutionStatus,
    ArchiveProposalDisplayState,
    DecisionRecordResult,
    ExternalAuthorityClaim,
    ExternalSourceLabel,
    ExternalTrustBoundary,
  } = types;
  const {
    decisionResultTone,
    displayStateTone,
    executionStatusTone,
    formatAuthorityClaim,
    formatExternalSourceLabel,
    formatIsoDateTime,
    formatOptionalText,
    formatTrustBoundary,
    isNotFoundApiError,
    sourceDisclosureTone,
    trustBoundaryMessage,
  } = display;

  assertOptionalTextFormatting(formatOptionalText);
  assertDateTimeFormatting(formatIsoDateTime);
  assertExternalSourceLabelFormatting({
    ExternalSourceLabel,
    formatExternalSourceLabel,
  });
  assertTrustBoundaryFormatting({
    ExternalTrustBoundary,
    formatTrustBoundary,
  });
  assertAuthorityClaimFormatting({
    ExternalAuthorityClaim,
    formatAuthorityClaim,
  });
  assertSourceDisclosureTones({
    ExternalAuthorityClaim,
    ExternalSourceLabel,
    ExternalTrustBoundary,
    sourceDisclosureTone,
  });
  assertTrustBoundaryMessages({
    ExternalAuthorityClaim,
    ExternalSourceLabel,
    ExternalTrustBoundary,
    trustBoundaryMessage,
  });
  assertArchiveDisplayStateTones({
    ArchiveProposalDisplayState,
    displayStateTone,
  });
  assertDecisionResultTones({
    DecisionRecordResult,
    decisionResultTone,
  });
  assertAccountabilityExecutionStatusTones({
    AccountabilityExecutionStatus,
    executionStatusTone,
  });
  assertNotFoundApiErrorHelper({
    IsoniaApiError,
    isNotFoundApiError,
  });
  assertTrustBoundaryMessagesAvoidForbiddenClaims({
    ExternalAuthorityClaim,
    ExternalSourceLabel,
    ExternalTrustBoundary,
    trustBoundaryMessage,
  });
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Accountability display tests passed from ${scriptDir}.`);

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
  await writeFile(
    outputUrl,
    rewriteRelativeImports(transpiled.outputText),
    "utf8",
  );
}

function rewriteRelativeImports(source) {
  return source
    .replace(
      /(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${withModuleExtension(specifier)}${suffix}`,
    )
    .replace(
      /(import\s+["'])(\.{1,2}\/[^"']+?)(["'])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${withModuleExtension(specifier)}${suffix}`,
    );
}

function withModuleExtension(specifier) {
  return /\.[cm]?js$/u.test(specifier) ? specifier : `${specifier}.mjs`;
}

async function importCacheModule(outputPath) {
  const outputUrl = new URL(outputPath, cacheRootUrl);
  return import(`${pathToFileURL(fileURLToPath(outputUrl)).href}?t=${Date.now()}`);
}

function assertOptionalTextFormatting(formatOptionalText) {
  assert.equal(formatOptionalText(undefined), "Not provided");
  assert.equal(formatOptionalText(" \n\t "), "Not provided");
  assert.equal(formatOptionalText("  mandate owner  "), "mandate owner");
  assert.equal(formatOptionalText(undefined, "No reason"), "No reason");
  assert.equal(formatOptionalText("   ", "No reason"), "No reason");
}

function assertDateTimeFormatting(formatIsoDateTime) {
  const formatted = formatIsoDateTime("2026-05-22T12:34:56.000Z");

  assert.equal(formatIsoDateTime(undefined), "Not set");
  assert.equal(formatIsoDateTime("not-a-timestamp"), "not-a-timestamp");
  assert.equal(typeof formatted, "string");
  assert.notEqual(formatted, "");
  assert.notEqual(formatted, "Not set");
}

function assertExternalSourceLabelFormatting({
  ExternalSourceLabel,
  formatExternalSourceLabel,
}) {
  assert.equal(formatExternalSourceLabel(undefined), "Source not disclosed");
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.ContractState),
    "Contract state",
  );
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.OnchainTransaction),
    "Onchain transaction",
  );
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.ExternalPlatform),
    "External platform",
  );
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.ImportedPreview),
    "Imported preview",
  );
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.ManualEvidence),
    "Manual evidence",
  );
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.DiscussionContext),
    "Discussion context",
  );
  assert.equal(
    formatExternalSourceLabel(ExternalSourceLabel.ImplementationArtifact),
    "Implementation artifact",
  );
  assert.equal(
    formatExternalSourceLabel("custom_provider_record"),
    "Custom Provider Record",
  );
}

function assertTrustBoundaryFormatting({
  ExternalTrustBoundary,
  formatTrustBoundary,
}) {
  assert.equal(formatTrustBoundary(undefined), "Trust boundary not disclosed");
  assert.equal(
    formatTrustBoundary(ExternalTrustBoundary.OnchainObservation),
    "Onchain observation",
  );
  assert.equal(
    formatTrustBoundary(ExternalTrustBoundary.ExternalPlatformRecord),
    "External platform record",
  );
  assert.equal(
    formatTrustBoundary(ExternalTrustBoundary.ManualContext),
    "Manual context",
  );
  assert.equal(
    formatTrustBoundary(ExternalTrustBoundary.ImportPreview),
    "Import preview",
  );
  assert.equal(
    formatTrustBoundary(ExternalTrustBoundary.UnverifiedLink),
    "Unverified link",
  );
  assert.equal(formatTrustBoundary("provider_pending"), "Provider Pending");
}

function assertAuthorityClaimFormatting({
  ExternalAuthorityClaim,
  formatAuthorityClaim,
}) {
  assert.equal(formatAuthorityClaim(undefined), "Authority not claimed");
  assert.equal(
    formatAuthorityClaim(ExternalAuthorityClaim.ContractAuthoritative),
    "Contract authoritative",
  );
  assert.equal(
    formatAuthorityClaim(
      ExternalAuthorityClaim.SourceAuthoritativeForExternalField,
    ),
    "Authoritative for external field",
  );
  assert.equal(
    formatAuthorityClaim(ExternalAuthorityClaim.EvidenceOnly),
    "Evidence only",
  );
  assert.equal(
    formatAuthorityClaim(ExternalAuthorityClaim.ContextOnly),
    "Context only",
  );
  assert.equal(
    formatAuthorityClaim(ExternalAuthorityClaim.None),
    "No authority claim",
  );
  assert.equal(
    formatAuthorityClaim("source_authority_review"),
    "Source Authority Review",
  );
}

function assertSourceDisclosureTones({
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
  sourceDisclosureTone,
}) {
  assert.equal(sourceDisclosureTone(undefined), "muted");
  assert.equal(
    sourceDisclosureTone({
      authorityClaim: ExternalAuthorityClaim.ContractAuthoritative,
    }),
    "success",
  );
  assert.equal(
    sourceDisclosureTone({
      trustBoundary: ExternalTrustBoundary.UnverifiedLink,
    }),
    "warning",
  );
  assert.equal(
    sourceDisclosureTone({
      trustBoundary: ExternalTrustBoundary.ImportPreview,
    }),
    "warning",
  );
  assert.equal(
    sourceDisclosureTone({
      sourceLabel: ExternalSourceLabel.ManualEvidence,
    }),
    "warning",
  );
  assert.equal(
    sourceDisclosureTone({
      trustBoundary: ExternalTrustBoundary.ManualContext,
    }),
    "warning",
  );
  assert.equal(
    sourceDisclosureTone({
      sourceLabel: ExternalSourceLabel.OnchainTransaction,
    }),
    "default",
  );
  assert.equal(
    sourceDisclosureTone({
      authorityClaim: ExternalAuthorityClaim.EvidenceOnly,
      sourceLabel: ExternalSourceLabel.ExternalPlatform,
      trustBoundary: ExternalTrustBoundary.ExternalPlatformRecord,
    }),
    "muted",
  );
}

function assertTrustBoundaryMessages({
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
  trustBoundaryMessage,
}) {
  const undisclosed = trustBoundaryMessage(undefined);
  assert.match(undisclosed, /did not include source disclosure metadata/i);
  assert.match(undisclosed, /treat it as indexed context/i);
  assert.match(undisclosed, /Control Plane supplies a source boundary/i);
  assert.doesNotMatch(undisclosed, /authority/i);

  const contractAuthoritative = trustBoundaryMessage({
    authorityClaim: ExternalAuthorityClaim.ContractAuthoritative,
  });
  assert.match(
    contractAuthoritative,
    /Contract\/onchain state is authority for Isonia governance state/i,
  );
  assert.match(
    contractAuthoritative,
    /External and manual material remains evidence, context, or annotation unless explicitly modeled otherwise/i,
  );

  const observedTransaction = trustBoundaryMessage({
    sourceLabel: ExternalSourceLabel.OnchainTransaction,
  });
  assert.match(observedTransaction, /observed transaction evidence/i);
  assert.match(
    observedTransaction,
    /not a completed business outcome by itself/i,
  );

  for (const disclosure of [
    { sourceLabel: ExternalSourceLabel.ManualEvidence },
    { trustBoundary: ExternalTrustBoundary.ManualContext },
  ]) {
    const manualMessage = trustBoundaryMessage(disclosure);
    assert.match(manualMessage, /Manual updates are annotations/i);
    assert.match(manualMessage, /not protocol truth/i);
  }

  const importPreview = trustBoundaryMessage({
    trustBoundary: ExternalTrustBoundary.ImportPreview,
  });
  assert.match(
    importPreview,
    /import preview is displayed for review as evidence\/context only/i,
  );
  assert.match(
    importPreview,
    /App Core does not treat it as governance authority/i,
  );

  const unverifiedLink = trustBoundaryMessage({
    trustBoundary: ExternalTrustBoundary.UnverifiedLink,
  });
  assert.match(unverifiedLink, /unverified link is displayed as context only/i);
  assert.match(
    unverifiedLink,
    /App Core does not verify or import provider state directly/i,
  );

  const externalPlatform = trustBoundaryMessage({
    trustBoundary: ExternalTrustBoundary.ExternalPlatformRecord,
  });
  assert.match(externalPlatform, /external platform record is evidence\/context/i);
  assert.match(
    externalPlatform,
    /backend has explicitly modeled the external field as authoritative/i,
  );

  const fallback = trustBoundaryMessage({
    authorityClaim: ExternalAuthorityClaim.EvidenceOnly,
    sourceLabel: ExternalSourceLabel.ExternalPlatform,
    trustBoundary: ExternalTrustBoundary.OnchainObservation,
  });
  assert.match(fallback, /record is evidence\/context/i);
  assert.match(
    fallback,
    /source disclosure explicitly marks the contract as authoritative for Isonia governance state/i,
  );
}

function assertArchiveDisplayStateTones({
  ArchiveProposalDisplayState,
  displayStateTone,
}) {
  for (const state of [
    ArchiveProposalDisplayState.Executed,
    ArchiveProposalDisplayState.Approved,
  ]) {
    assert.equal(displayStateTone(state), "success", `${state} should be success`);
  }

  for (const state of [
    ArchiveProposalDisplayState.Cancelled,
    ArchiveProposalDisplayState.ExecutionFailed,
    ArchiveProposalDisplayState.Rejected,
  ]) {
    assert.equal(displayStateTone(state), "danger", `${state} should be danger`);
  }

  for (const state of [
    ArchiveProposalDisplayState.Active,
    ArchiveProposalDisplayState.ExecutionPending,
    ArchiveProposalDisplayState.UnknownExternalState,
  ]) {
    assert.equal(displayStateTone(state), "warning", `${state} should be warning`);
  }

  assert.equal(displayStateTone("provider_pending"), "muted");
}

function assertDecisionResultTones({
  DecisionRecordResult,
  decisionResultTone,
}) {
  for (const result of [
    DecisionRecordResult.Approved,
    DecisionRecordResult.Executed,
  ]) {
    assert.equal(
      decisionResultTone(result),
      "success",
      `${result} should be success`,
    );
  }

  for (const result of [
    DecisionRecordResult.Cancelled,
    DecisionRecordResult.Expired,
    DecisionRecordResult.Failed,
    DecisionRecordResult.Rejected,
  ]) {
    assert.equal(
      decisionResultTone(result),
      "danger",
      `${result} should be danger`,
    );
  }

  const handledResults = new Set([
    DecisionRecordResult.Approved,
    DecisionRecordResult.Cancelled,
    DecisionRecordResult.Executed,
    DecisionRecordResult.Expired,
    DecisionRecordResult.Failed,
    DecisionRecordResult.Rejected,
  ]);

  for (const result of Object.values(DecisionRecordResult)) {
    if (!handledResults.has(result)) {
      assert.equal(
        decisionResultTone(result),
        "warning",
        `${result} should be warning`,
      );
    }
  }

  assert.equal(decisionResultTone(undefined), "muted");
}

function assertAccountabilityExecutionStatusTones({
  AccountabilityExecutionStatus,
  executionStatusTone,
}) {
  assert.equal(
    executionStatusTone(AccountabilityExecutionStatus.Completed),
    "success",
  );

  for (const status of [
    AccountabilityExecutionStatus.Blocked,
    AccountabilityExecutionStatus.Failed,
    AccountabilityExecutionStatus.Cancelled,
  ]) {
    assert.equal(
      executionStatusTone(status),
      "danger",
      `${status} should be danger`,
    );
  }

  assert.equal(
    executionStatusTone(AccountabilityExecutionStatus.InProgress),
    "warning",
  );
  assert.equal(
    executionStatusTone(AccountabilityExecutionStatus.NotStarted),
    "muted",
  );
  assert.equal(executionStatusTone(AccountabilityExecutionStatus.Unknown), "muted");
  assert.equal(executionStatusTone(undefined), "muted");
}

function assertNotFoundApiErrorHelper({
  IsoniaApiError,
  isNotFoundApiError,
}) {
  assert.equal(isNotFoundApiError(apiErrorFixture(IsoniaApiError, 404)), true);
  assert.equal(isNotFoundApiError(apiErrorFixture(IsoniaApiError, 500)), false);

  const genericError = new Error("missing");
  Object.defineProperty(genericError, "status", {
    value: 404,
  });
  assert.equal(isNotFoundApiError(genericError), false);
}

function apiErrorFixture(IsoniaApiError, status) {
  return new IsoniaApiError({
    method: "GET",
    path: "/v1/test",
    responseText: "",
    status,
    statusText: status === 404 ? "Not Found" : "Server Error",
    url: "http://localhost/v1/test",
  });
}

function assertTrustBoundaryMessagesAvoidForbiddenClaims({
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
  trustBoundaryMessage,
}) {
  const messages = [
    trustBoundaryMessage(undefined),
    trustBoundaryMessage({
      authorityClaim: ExternalAuthorityClaim.ContractAuthoritative,
    }),
    trustBoundaryMessage({
      sourceLabel: ExternalSourceLabel.OnchainTransaction,
    }),
    trustBoundaryMessage({
      sourceLabel: ExternalSourceLabel.ManualEvidence,
    }),
    trustBoundaryMessage({
      trustBoundary: ExternalTrustBoundary.ManualContext,
    }),
    trustBoundaryMessage({
      trustBoundary: ExternalTrustBoundary.ImportPreview,
    }),
    trustBoundaryMessage({
      trustBoundary: ExternalTrustBoundary.UnverifiedLink,
    }),
    trustBoundaryMessage({
      trustBoundary: ExternalTrustBoundary.ExternalPlatformRecord,
    }),
    trustBoundaryMessage({
      authorityClaim: ExternalAuthorityClaim.ContextOnly,
      sourceLabel: ExternalSourceLabel.DiscussionContext,
      trustBoundary: ExternalTrustBoundary.OnchainObservation,
    }),
  ];
  const forbiddenClaims = [
    "production ready",
    "public beta",
    "audit",
    "provider complete",
    "verified by App Core",
    "App Core imports provider state",
  ];

  for (const message of messages) {
    for (const claim of forbiddenClaims) {
      assert.doesNotMatch(
        message,
        new RegExp(escapeRegExp(claim), "i"),
        `"${claim}" should not appear in trust-boundary copy`,
      );
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
