# Changelog

All notable changes to `@isonia/app-core` are documented here.

`package.json.version` uses SemVer without a leading `v`. Git tags use the matching version with a leading `v`, and GitHub dependency refs may point at those tags.

## [Unreleased]

## [0.7.0-alpha.3]

### Fixed

- Fixed activation indexing wait recovery after batch activation and read-model catch-up.
- Forced local demo Reown/AppKit setup toward EOA-only behavior.
- Made setup, finalization, proposal creation, proposal action, and contract batch write paths pass the connected signer account explicitly.

### Changed

- Kept EIP-5792 wallet batching gated and disabled by default.

## [0.7.0-alpha.2]

### Added

- Added organization finalization read support and setup finalization UX.
- Added transaction-modal execution for `finalizeOrganization`.

### Changed

- Updated `@isonia/sdk` dependency ref to `v0.7.0-alpha.2`.
- Updated `@isonia/types` dependency ref to `v0.7.0-alpha.2`.
- Disabled or explained bootstrap-admin actions blocked after organization finalization.

## [0.7.0-alpha.1]

### Added

- Added Control Plane activation capability reads for v0.7 setup activation mode selection.
- Added typed contract batch activation planning and transaction modal execution when Control Plane explicitly reports support.

### Changed

- Updated `@isonia/sdk` and `@isonia/types` dependency refs to v0.7-compatible tags.
- Kept compatible serial activation as fallback and EIP-5792 as a gated, non-primary prototype path.

## [0.6.0-alpha.18]

### Added

- Added a reusable segmented control UI primitive.
- Recorded the Proposal Action Builder as a future roadmap item.

### Changed

- Moved proposal creation and proposal actions to the single transaction modal UX.
- Improved proposal action disabled states and authority guidance.
- Polished Governance Structure header controls and graph/list segmented switching.
- Replaced unhelpful body identifiers with role/body labels where read models allow.

### Fixed

- Removed the empty Governance Structure minimap while keeping graph controls and Fit to view.
- Removed the old inline proposal transaction status from the Actions tab.

## [0.6.0-alpha.17]

### Added

- Added light/dark color mode support and a compact header theme toggle.

### Changed

- Aligned Reown/AppKit theme variables with the Isonia visual system.
- Refined AppShell topbar, wallet chip, and sidebar navigation.

### Fixed

- Fixed a color-mode toggle freeze by stabilizing theme synchronization.

## [0.6.0-alpha.16]

### Changed

- Replaced the legacy governance page with the new Governance Structure view.

### Fixed

- Kept the graph route as a compatibility alias for the Governance Structure view.

## [0.6.0-alpha.15]

### Added

- Added Governance Structure visual view with authority graph, structure metrics, and tabs for bodies, roles, mandates, policies, and routes.
- Added React Flow-powered graph rendering for organization authority relationships.

### Changed

- Refined AppShell and proposal detail visual hierarchy toward the v0.6 product design direction.
- Reorganized proposal detail content into clearer overview, route, actions, result, and technical sections.
- Reduced default technical noise on proposal pages.

## [0.6.0-alpha.14]

### Added

- Added feature-flagged EIP-5792 activation batch prototype with serial fallback.
- Added wallet capability detection for batch activation calls.
- Kept read-model completion as the source of activation progress.

### Changed

- Improved EIP-5792 batch capability diagnostics and MetaMask compatibility handling.
- Clarified unsupported local-chain behavior for activation batch execution.

## [0.6.0-alpha.13]

### Changed

- Hardened organization activation serial execution with group-level run actions, retry behavior, and sequential progress gating.
- Improved activation progress recovery from indexed read models.
- Package version bumped to `0.6.0-alpha.13`.

## [0.6.0-alpha.12]

### Changed

- Consolidated diagnostics into the app home and diagnostics surface.
- Removed scattered Diagnostics buttons from normal setup, activation, and proposal flows.
- Cleaned AppShell diagnostics navigation and status access.
- Package version bumped to `0.6.0-alpha.12`.

## [0.6.0-alpha.11]

### Added

- Added sequential organization activation flow with step unlocking and group progress.
- Added signer preflight for bootstrap activation actions.
- Added serial transaction modal execution for activation groups.

### Fixed

- Fixed activation wizard blocking logic so future-step validation does not block earlier activation groups.
- Restored creation wizard template and governance structure steps.
- Polished setup help icons, address validation icon, form layout, and root review details.
- Cleaned setup feature structure and naming where safe.

## [0.6.0-alpha.10]

### Changed

- Refined setup creation wizard after alpha.10 review.
- Split organization activation into a dedicated setup activation page.
- Improved inline transaction hash component.
- Clarified bootstrap activation authority copy.
- Simplified transaction modal presentation and help popover behavior.
- Applied Isonia palette and IBM Plex font stacks.
- Reworked Simple DAO+ setup wizard flow with sequential step unlocking, local field validation, slug input handling, calmer policy route previews, and collapsed activation action details.
- Added Hugeicons free icon dependencies behind the UI kit icon wrapper.
- Package version bumped to `0.6.0-alpha.10`.

### Fixed

- Fixed setup wizard UX regressions and reduced early validation noise.
- Fixed multi-address holder input click/paste behavior.
- Improved non-Latin organization name slug fallback.
- Fixed setup transaction modal execution so opening the modal no longer starts the transaction automatically.

## [0.6.0-alpha.9]

### Added

- Added reusable transaction modal foundation for single and serial transaction UX.
- Started setup execution integration with transaction modal status guidance.

### Changed

- Package version bumped to `0.6.0-alpha.9`.

## [0.6.0-alpha.8]

### Added

- Added interaction-system UI kit primitives for forms, menus, dialogs, drawers, tooltips, toggletips, and contextual help terms.

## [0.6.0-alpha.7]

### Added

- Added IsoLogo brand component using IsoniaOS logo assets.
- Added UI kit foundation with Chakra abstraction layer.
- Replaced address avatar with local DiceBear identicon generation.
- Improved address copy UX with click-to-copy and toast feedback.

## [0.6.0-alpha.6]

### Fixed

- Fixed production preview startup by stabilizing web3 dependency chunking for the Docker/demo build.

## [0.6.0-alpha.5]

### Added

- Added app-core linting and CI lint/typecheck/address-test checks.

### Changed

- Added repository line-ending policy with `.gitattributes` for v0.6 hardening.
- Package version bumped to `0.6.0-alpha.5`.
- Node engine baseline remains `>=22`.
- Dependencies updated.

## [0.6.0-alpha.4]

### Changed

- Improved proposal lifecycle demo UX with clearer route explanation, contextual proposal actions, local Hardhat time controls, transaction status guidance, and final DemoTarget result visibility.
- Package version bumped to `0.6.0-alpha.4`.

## [0.6.0-alpha.3]

### Changed

- Improved setup execution UX with clearer lifecycle labels, transaction hash visibility, Control Plane waiting guidance, failure recovery hints, and an execution summary.
- Package version bumped to `0.6.0-alpha.3`.

## [0.6.0-alpha.2]

### Added

- Added a guided Simple DAO+ setup wizard shell over the existing browser-side draft flow, with template, identity, bodies, holders, policy route, and draft review steps.
- Added a persistent v0.6 review backlog for release hygiene and non-blocking app-core review notes.

### Changed

- Package version bumped to `0.6.0-alpha.2` and shared Isonia dependency refs updated to the v0.6 alpha tag set.

## [0.6.0-alpha.1]

### Added

- Added reusable address primitives for v0.6, including deterministic avatars,
  address display, single and multi-address inputs, removable chips, parsing,
  validation, normalization, deduplication utilities, and address utility tests.
- Added v0.6 address component implementation preparation notes.
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

- Prepared repository context for v0.6 alpha work after the closed v0.5 compatibility set.
- Simple DAO+ setup now uses the reusable address input, multi-address holder
  input, and address display primitives for organization admin, executor, holder,
  draft review, and setup execution address surfaces.
- Runtime config loading now falls through from `isonia.config.local.json` to `isonia.config.json` before using built-in defaults.
- Updated README shared package examples to known-good v0.5 alpha GitHub tags.
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

[Unreleased]: https://github.com/isoniaos/app-core/compare/v0.7.0-alpha.3...HEAD
[0.7.0-alpha.3]: https://github.com/isoniaos/app-core/compare/v0.7.0-alpha.2...v0.7.0-alpha.3
[0.7.0-alpha.2]: https://github.com/isoniaos/app-core/compare/v0.7.0-alpha.1...v0.7.0-alpha.2
[0.7.0-alpha.1]: https://github.com/isoniaos/app-core/releases/tag/v0.7.0-alpha.1
[0.6.0-alpha.18]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.18
[0.6.0-alpha.17]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.17
[0.6.0-alpha.16]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.16
[0.6.0-alpha.15]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.15
[0.6.0-alpha.14]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.14
[0.6.0-alpha.13]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.13
[0.6.0-alpha.12]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.12
[0.6.0-alpha.11]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.11
[0.6.0-alpha.10]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.10
[0.6.0-alpha.9]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.9
[0.6.0-alpha.8]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.8
[0.6.0-alpha.7]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.7
[0.6.0-alpha.6]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.6
[0.6.0-alpha.5]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.5
[0.6.0-alpha.4]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.4
[0.6.0-alpha.3]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.3
[0.6.0-alpha.2]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.2
[0.6.0-alpha.1]: https://github.com/isoniaos/app-core/releases/tag/v0.6.0-alpha.1
[0.5.0-alpha.2]: https://github.com/isoniaos/app-core/releases/tag/v0.5.0-alpha.2
[0.1.0]: https://github.com/isoniaos/app-core/releases/tag/v0.1.0
