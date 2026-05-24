# IsoniaOS App Core Agent Rules

These rules apply to Codex and other AI agents working in `app-core`.

When this repository is used inside the IsoniaOS workspace, read the workspace-level `../AGENTS.md` first, then return to this file for repository-specific instructions.

## Repository Purpose

`app-core` is the public self-hostable IsoniaOS governance console.

It is a React + Vite SPA for presentation and interaction. It is not a source of governance authority.

## Active Target

Current active target: v0.8 accountability and integration-preview wave.

The v0.8 UI baseline is read-oriented:

- Public Governance Archive;
- Basic Accountability Dashboard;
- proposal and route visibility;
- accountability records and action metadata;
- external evidence/context with explicit trust boundaries;
- source disclosure near affected data.

Public beta readiness is a future decision point, not a current claim.

## Dependency Boundaries

- Use `@isonia/sdk` for typed Control Plane calls when a SDK method exists.
- Use `@isonia/types` DTOs, enums, and constants rather than local duplicates.
- Do not duplicate endpoint fetch wrappers in App Core when the SDK should own them.
- Keep theme concerns delegated to theme packages where possible.
- Do not import demo-stack internals, integration-lab fixtures, Control Plane internals, or SaaS-only modules.

## Authority and Trust UX

- Contracts are authoritative for modeled onchain governance state.
- Control Plane data is an index/read model that may lag or fail.
- External records are evidence/context unless explicitly modeled as authority.
- Manual accountability updates are annotations, not protocol truth.
- Show source disclosure, stale/error/unknown states, and trust boundaries near affected data.

## Provider and Demo Rules

- Do not add Snapshot, Safe, Tally, Agora, GitHub, Discourse, or block explorer API calls unless explicitly scoped.
- Do not hardcode Sepolia lab fixtures, provider experiments, presentation scenarios, customer ABIs, or DemoTarget assumptions into core UI logic.
- Do not use package version strings as runtime capability checks.
- Do not add SaaS-only features such as billing, subscriptions, tenant admin, premium analytics, hosted operator dashboards, or private support tooling.

## Wallet and Runtime Config

Wallet UX may use Reown AppKit when scoped, while wagmi and viem remain the core EVM interaction layer.

Self-hosted mode must still work without a Reown Project ID through an injected connector fallback.

Runtime config should make wallet and deployment capabilities explicit.

## Versioning and Claims

- Keep package versions as SemVer without a leading `v`.
- Do not create Git tags automatically.
- Update `CHANGELOG.md` under `Unreleased` for user-visible App Core changes.
- Do not introduce production, audit, public beta, SaaS, legal, provider-completeness, or ISO launch-readiness claims.

## Verification

For UI behavior changes, run the strongest relevant subset:

- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm build`
- relevant browser checks for visual or interaction changes
- `git diff --check`

For AGENTS-only changes, `git diff --check` is sufficient.
