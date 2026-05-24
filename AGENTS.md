# IsoniaOS App Core Agent Instructions

## Scope

This repository owns the React + Vite self-hostable IsoniaOS governance console. It presents and interacts with contract-modeled governance state, Control Plane read models, wallet flows, public archive surfaces, accountability records, diagnostics, source disclosure, and local theme integration.

It does not own protocol authority, Control Plane indexing logic, SDK package contracts, integration-lab fixtures, SaaS-only billing or tenant administration, private hosted operations, or token launch behavior.

## Workspace Instruction Chain

When working inside the private IsoniaOS workspace, read:

1. `../AGENTS.md`
2. `../CURRENT_ROADMAP.md`
3. relevant `../private-docs/` index, governance, roadmap, and migration docs
4. this repository `AGENTS.md`
5. this repository `/docs` and `README.md`
6. current source/config files before editing

If this repository is cloned standalone, use this file as the local agent entry point and avoid relying on private workspace-only paths.

## Stack and Commands

- React 19, Vite, TypeScript
- Chakra UI, local UI-kit primitives, `@isonia/theme-default`
- wagmi/viem for EVM interaction
- optional Reown AppKit wallet UX
- Control Plane access through `@isonia/sdk` where available

Useful commands:

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm preview
git diff --check
```

Set `ISONIA_WORKSPACE_SOURCES=true` only when intentionally testing adjacent `../types` and `../sdk` source trees.

## Development Principles

- App Core is presentation and interaction, not governance authority.
- Use `@isonia/sdk` for typed Control Plane calls when a method exists.
- Use `@isonia/types` DTOs, enums, constants, and source disclosure shapes instead of local duplicates.
- Keep wallet connection state behind `src/wallet/useWalletConnection.ts`.
- Keep trust boundaries, stale/error/unknown states, and source disclosures visible near affected data.
- Keep demo target behavior local/lab scoped and do not hardcode Sepolia lab fixtures, provider experiments, presentation scenarios, customer ABIs, or package-version capability assumptions into core UI logic.
- Do not add SaaS-only billing, subscriptions, tenant admin, premium analytics, hosted operator dashboards, private support tooling, or token launch behavior.
- Do not make production, audit, public beta, legal, SaaS, provider-completeness, grant, ISO launch, or token launch readiness claims.

## Documentation Rules

Update [`README.md`](README.md), local [`docs/`](docs/), and `CHANGELOG.md` under `Unreleased` when runtime config, wallet behavior, Control Plane API usage, UI behavior, data trust boundaries, or user/developer/operator-visible flows change.

Update the public docs repository when public configuration, user workflows, developer guidance, operator behavior, or public claims change.

## Testing and Validation

For UI behavior changes, run the strongest relevant subset:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
git diff --check
```

Use browser checks for visual, interaction, routing, wallet, or responsive changes. For documentation-only changes, `git diff --check` is normally sufficient.
