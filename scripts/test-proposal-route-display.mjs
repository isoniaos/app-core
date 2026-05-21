import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/proposal-route-display-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);

await rm(cacheRootPath, { force: true, recursive: true });

const sourceModules = [
  ["../src/utils/format.ts", "src/utils/format.mjs"],
  ["../src/utils/display-labels.ts", "src/utils/display-labels.mjs"],
  [
    "../src/features/proposals/proposal-body-labels.ts",
    "src/features/proposals/proposal-body-labels.mjs",
  ],
  [
    "../src/features/proposals/proposal-status-helpers.ts",
    "src/features/proposals/proposal-status-helpers.mjs",
  ],
  [
    "../src/features/proposals/proposal-route-display.ts",
    "src/features/proposals/proposal-route-display.mjs",
  ],
];

for (const [sourcePath, outputPath] of sourceModules) {
  await transpileModule(new URL(sourcePath, import.meta.url), outputPath);
}

try {
  const types = await import("@isonia/types");
  const statusHelpers = await importCacheModule(
    "src/features/proposals/proposal-status-helpers.mjs",
  );
  const routeDisplay = await importCacheModule(
    "src/features/proposals/proposal-route-display.mjs",
  );

  const { ProposalStatus, ProposalType, RouteBlockedReasonCode } = types;
  const {
    isCompletedProposalStatus,
    isTerminalProposalStatus,
  } = statusHelpers;
  const {
    getProposalNextActionContext,
    getRouteBlockedReasonTone,
    getRouteOverviewMetricLabel,
    getRoutePanelDisplay,
    getRouteReadinessDisplay,
  } = routeDisplay;

  assertStatusHelpers({
    isCompletedProposalStatus,
    isTerminalProposalStatus,
    ProposalStatus,
  });

  assertExecutedProposalDisplay({
    getProposalNextActionContext,
    getRouteBlockedReasonTone,
    getRouteOverviewMetricLabel,
    getRoutePanelDisplay,
    getRouteReadinessDisplay,
    ProposalStatus,
    ProposalType,
    RouteBlockedReasonCode,
  });

  for (const status of [ProposalStatus.Cancelled, ProposalStatus.Expired]) {
    assertCancelledOrExpiredDisplay({
      getProposalNextActionContext,
      getRouteBlockedReasonTone,
      getRoutePanelDisplay,
      getRouteReadinessDisplay,
      ProposalStatus,
      ProposalType,
      RouteBlockedReasonCode,
      status,
    });
  }

  assertVetoedDisplay({
    getProposalNextActionContext,
    getRoutePanelDisplay,
    getRouteReadinessDisplay,
    ProposalStatus,
    ProposalType,
    RouteBlockedReasonCode,
  });

  assertNonTerminalBlockedDisplay({
    getRouteBlockedReasonTone,
    getRoutePanelDisplay,
    getRouteReadinessDisplay,
    ProposalStatus,
    ProposalType,
    RouteBlockedReasonCode,
  });
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Proposal route display tests passed from ${scriptDir}.`);

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

function assertStatusHelpers({
  isCompletedProposalStatus,
  isTerminalProposalStatus,
  ProposalStatus,
}) {
  const terminalStatuses = [
    ProposalStatus.Cancelled,
    ProposalStatus.Executed,
    ProposalStatus.Expired,
    ProposalStatus.Vetoed,
  ];

  for (const status of terminalStatuses) {
    assert.equal(
      isTerminalProposalStatus(status),
      true,
      `${status} should be terminal`,
    );
  }

  assert.equal(isCompletedProposalStatus(ProposalStatus.Executed), true);

  for (const status of Object.values(ProposalStatus)) {
    if (status !== ProposalStatus.Executed) {
      assert.equal(
        isCompletedProposalStatus(status),
        false,
        `${status} should not be completed`,
      );
    }

    if (!terminalStatuses.includes(status)) {
      assert.equal(
        isTerminalProposalStatus(status),
        false,
        `${status} should not be terminal`,
      );
    }
  }
}

function assertExecutedProposalDisplay({
  getProposalNextActionContext,
  getRouteBlockedReasonTone,
  getRouteOverviewMetricLabel,
  getRoutePanelDisplay,
  getRouteReadinessDisplay,
  ProposalStatus,
  ProposalType,
  RouteBlockedReasonCode,
}) {
  const reason = blockedReason(
    RouteBlockedReasonCode.AlreadyExecuted,
    "Proposal has already executed.",
  );
  const route = routeFixture({
    ProposalType,
    blockedReasons: [reason],
    status: ProposalStatus.Executed,
  });
  const proposal = proposalFixture({ ProposalType, status: ProposalStatus.Executed });
  const readiness = getRouteReadinessDisplay({
    route,
    routeError: undefined,
    status: proposal.status,
  });
  const panel = getRoutePanelDisplay(route, []);
  const action = getProposalNextActionContext({
    bodies: [],
    proposal,
    route,
    routeError: undefined,
  });

  assert.equal(readiness.label, "Lifecycle complete");
  assert.equal(panel.executionBadgeLabel, "Lifecycle complete");
  assert.equal(panel.heroTitle, "Proposal lifecycle is complete");
  assert.equal(panel.heroBadgeLabel, "Complete");
  assert.equal(
    panel.executionStateTitle,
    "No further execution action is available",
  );
  assert.match(panel.heroSummary, /has executed/i);
  assert.match(panel.heroSummary, /cannot be executed again/i);
  assert.doesNotMatch(panel.heroTitle, /blocked/i);
  assert.equal(panel.nextActionSummary.value, "No further action");
  assert.equal(action.actor, "No further action");
  assert.equal(getRouteOverviewMetricLabel(proposal.status), "Next action");
  assert.equal(panel.nextActionLabel, "Next action");
  assert.equal(panel.blockedReasonsSection.title, "Terminal Route Notes");
  assert.notEqual(panel.blockedReasonsSection.title, "Blocked Reasons");
  assert.equal(getRouteBlockedReasonTone({ reason, terminal: true }), "muted");
}

function assertCancelledOrExpiredDisplay({
  getProposalNextActionContext,
  getRouteBlockedReasonTone,
  getRoutePanelDisplay,
  getRouteReadinessDisplay,
  ProposalStatus,
  ProposalType,
  RouteBlockedReasonCode,
  status,
}) {
  const reasonCode =
    status === ProposalStatus.Cancelled
      ? RouteBlockedReasonCode.Cancelled
      : RouteBlockedReasonCode.Expired;
  const reason = blockedReason(reasonCode, `Proposal is ${status}.`);
  const route = routeFixture({
    ProposalType,
    blockedReasons: [reason],
    status,
  });
  const proposal = proposalFixture({ ProposalType, status });
  const readiness = getRouteReadinessDisplay({
    route,
    routeError: undefined,
    status: proposal.status,
  });
  const panel = getRoutePanelDisplay(route, []);
  const action = getProposalNextActionContext({
    bodies: [],
    proposal,
    route,
    routeError: undefined,
  });
  const formattedStatus = status === ProposalStatus.Cancelled ? "Cancelled" : "Expired";

  assert.equal(readiness.label, "Terminal state");
  assert.equal(panel.executionBadgeLabel, "Terminal state");
  assert.equal(panel.heroTitle, "Proposal is in a terminal state");
  assert.equal(panel.heroBadgeLabel, "No further action");
  assert.equal(panel.nextActionSummary.value, "Terminal state");
  assert.match(panel.nextActionSummary.detail, new RegExp(formattedStatus));
  assert.match(action.detail, new RegExp(formattedStatus));
  assert.equal(action.actor, "No standard action");
  assert.equal(panel.nextActionLabel, "Next action");
  assert.equal(panel.blockedReasonsSection.title, "Terminal Route Notes");
  assert.notEqual(panel.blockedReasonsSection.title, "Blocked Reasons");
  assert.equal(getRouteBlockedReasonTone({ reason, terminal: panel.terminal }), "muted");
}

function assertVetoedDisplay({
  getProposalNextActionContext,
  getRoutePanelDisplay,
  getRouteReadinessDisplay,
  ProposalStatus,
  ProposalType,
  RouteBlockedReasonCode,
}) {
  const reason = blockedReason(
    RouteBlockedReasonCode.Vetoed,
    "A veto has been recorded.",
  );
  const route = routeFixture({
    ProposalType,
    blockedReasons: [reason],
    status: ProposalStatus.Vetoed,
  });
  const proposal = proposalFixture({ ProposalType, status: ProposalStatus.Vetoed });
  const readiness = getRouteReadinessDisplay({
    route,
    routeError: undefined,
    status: proposal.status,
  });
  const panel = getRoutePanelDisplay(route, []);
  const action = getProposalNextActionContext({
    bodies: [],
    proposal,
    route,
    routeError: undefined,
  });

  assert.equal(readiness.label, "Terminal state");
  assert.equal(panel.executionBadgeLabel, "Terminal state");
  assert.equal(panel.heroTitle, "Proposal is in a terminal state");
  assert.equal(panel.heroBadgeLabel, "No further action");
  assert.equal(panel.nextActionSummary.value, "Terminal state");
  assert.equal(action.actor, "No standard action");
  assert.equal(panel.nextActionLabel, "Next action");
  assert.notEqual(panel.nextActionLabel, "Next blocker");
  assert.equal(panel.blockedReasonsSection.title, "Terminal Route Notes");
  assert.equal(panel.executionTone, "danger");
}

function assertNonTerminalBlockedDisplay({
  getRouteBlockedReasonTone,
  getRoutePanelDisplay,
  getRouteReadinessDisplay,
  ProposalStatus,
  ProposalType,
  RouteBlockedReasonCode,
}) {
  const reason = blockedReason(
    RouteBlockedReasonCode.NotQueued,
    "Proposal must be queued before execution.",
  );
  const route = routeFixture({
    ProposalType,
    blockedReasons: [reason],
    status: ProposalStatus.Approved,
  });
  const readiness = getRouteReadinessDisplay({
    route,
    routeError: undefined,
    status: ProposalStatus.Approved,
  });
  const panel = getRoutePanelDisplay(route, []);
  const visibleDecisionText = [
    readiness.label,
    panel.executionBadgeLabel,
    panel.heroTitle,
    panel.heroBadgeLabel,
    panel.heroSummary,
    panel.nextActionLabel,
    panel.nextActionSummary.value,
    panel.blockedReasonsSection.title,
  ].join("\n");

  assert.equal(readiness.label, "Route blocked");
  assert.equal(panel.executionBadgeLabel, "Blocked");
  assert.equal(panel.heroTitle, "Execution is currently blocked");
  assert.equal(panel.heroBadgeLabel, "Not ready");
  assert.equal(panel.nextActionLabel, "Next blocker");
  assert.equal(panel.blockedReasonsSection.title, "Blocked Reasons");
  assert.match(panel.heroSummary, /Proposal must be queued before execution\./);
  assert.equal(getRouteBlockedReasonTone({ reason, terminal: false }), "warning");
  assert.doesNotMatch(visibleDecisionText, /Lifecycle complete/);
  assert.doesNotMatch(visibleDecisionText, /Terminal state/);
}

function proposalFixture({ ProposalType, status }) {
  return {
    chainId: 31337,
    createdAtChain: "1",
    createdBlock: "1",
    createdTxHash:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    creatorAddress: "0x0000000000000000000000000000000000000001",
    orgId: "1",
    policyVersion: "1",
    proposalId: "1",
    proposalType: ProposalType.Standard,
    status,
    title: "Proposal #1",
    value: "0",
  };
}

function routeFixture({
  ProposalType,
  blockedReasons,
  executable = false,
  status,
}) {
  return {
    chainId: 31337,
    execution: {
      blockedReasons,
      executable,
    },
    orgId: "1",
    policyVersion: "1",
    proposalId: "1",
    proposalType: ProposalType.Standard,
    requiredApprovalBodies: [],
    status,
    timelock: {
      required: false,
      satisfied: true,
      seconds: "0",
    },
    vetoBodies: [],
  };
}

function blockedReason(code, message) {
  return {
    code,
    message,
  };
}
