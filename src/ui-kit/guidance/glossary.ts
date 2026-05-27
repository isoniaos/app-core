export const glossary = {
  controlPlane: {
    title: "Control Plane",
    description:
      "The backend that indexes chain events and serves read models for the app.",
    details:
      "The Control Plane explains and visualizes governance state, but on-chain contracts remain the source of governance authority.",
  },
  dataHash: {
    title: "Data hash",
    description:
      "A compact hash that identifies proposal metadata or action data without storing all content on-chain.",
    details:
      "The hash lets observers verify that off-chain content matches the data referenced by a proposal or execution path.",
  },
  localDemoTarget: {
    title: "Local demo target",
    description:
      "An optional local-only target contract used by the current proposal execution flow.",
    details:
      "The local demo target keeps execution intentionally narrow while the broader governance flow is being validated.",
  },
  executorBody: {
    title: "Executor body",
    description:
      "The governance body authorized by policy to execute a proposal after required checks pass.",
  },
  policySnapshot: {
    title: "Policy snapshot",
    description:
      "The policy version captured when a proposal is created.",
    details:
      "Route explanation must use the captured policy version instead of silently switching to the latest policy.",
  },
  projection: {
    title: "Projection",
    description:
      "A replayable read model derived from raw blockchain events.",
    details:
      "Projections make governance state easier to query while preserving the chain as the source of truth.",
  },
  proposalLifecycle: {
    title: "Proposal lifecycle",
    description:
      "The ordered set of states a proposal moves through from creation to final outcome.",
    details:
      "Lifecycle states can include approval, veto, queue, execution, cancellation, and other terminal states depending on policy.",
  },
  route: {
    title: "Route",
    description:
      "The approval, veto, timelock, and execution path required for a proposal.",
  },
  timelock: {
    title: "Timelock",
    description:
      "A required waiting period before an approved and queued proposal can execute.",
  },
  vetoBody: {
    title: "Veto body",
    description:
      "A governance body that can block a proposal under the active policy route.",
  },
} as const;

export type IsoGlossaryTerm = keyof typeof glossary;

export interface IsoGlossaryEntry {
  readonly description: string;
  readonly details?: string;
  readonly title: string;
}
