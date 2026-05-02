# Changelog

All notable changes to `@isonia/app-core` are documented here.

`package.json.version` uses SemVer without a leading `v`. Git tags use the matching version with a leading `v`, and GitHub dependency refs may point at those tags.

## [Unreleased]

### Added

- Added this changelog for release tracking and future release notes.
- Runtime config now supports an ignored `isonia.config.local.json` override before falling back to `isonia.config.json`.
- Simple DAO+ setup draft inputs now generate editable browser-only setup actions with validation warnings before any transaction execution exists.
- Hardened Simple DAO+ setup draft validation with blocking readiness status, severity summaries, action-level warnings, and dependency checks.
- Setup execution now supports one-by-one `create_body` transactions after organization indexing, including `BodyCreated` receipt parsing and indexed body ID resolution.
- Setup execution now supports one-by-one `create_role` transactions after body indexing, including `RoleCreated` receipt parsing and indexed role ID resolution.
- Setup execution now supports one-by-one `assign_mandate` transactions after role indexing, including `MandateAssigned` receipt parsing and indexed mandate ID resolution.
- Setup execution now supports one-by-one `set_policy_rule` transactions after required bodies, roles, and mandates are indexed, including `PolicyRuleSet` receipt parsing and indexed policy version resolution.
- Added a project wallet connection hook backed by Wagmi `useConnection` so feature code no longer imports deprecated account state directly.

### Changed

- Runtime config loading now falls through from `isonia.config.local.json` to `isonia.config.json` before using built-in defaults.
- Updated README shared package examples to current v0.5 alpha GitHub tags.
- Default TypeScript and Vite builds now resolve `@isonia/sdk` and `@isonia/types` through declared package dependencies.
- Workspace-source aliases for `../sdk/src` and `../types/src` are now opt-in through `ISONIA_WORKSPACE_SOURCES=true`.
- Updated pinned shared package refs to `@isonia/types` `v0.5.0-alpha.5`, `@isonia/sdk` `v0.5.0-alpha.6`, and `@isonia/theme-default` `v0.5.0-alpha.2`.

## [0.5.0-alpha.2]

### Added

- Control Plane diagnostics route and global system status surface.
- Proposal create and lifecycle transaction flows behind runtime feature gates.
- Runtime wallet diagnostics for Reown AppKit and injected connector fallback modes.
- Metadata fallback handling for governance entities and proposals.

## [0.1.0]

### Added

- Initial React + Vite self-hostable governance console foundation.
- Organization, governance, proposal, proposal route, and graph read views.
- Runtime configuration loading from `isonia.config.json`.
- Default theme integration through `@isonia/theme-default`.

[Unreleased]: https://github.com/isoniaos/app-core/compare/v0.5.0-alpha.6...HEAD
[0.5.0-alpha.2]: https://github.com/isoniaos/app-core/releases/tag/v0.5.0-alpha.2
[0.1.0]: https://github.com/isoniaos/app-core/releases/tag/v0.1.0
