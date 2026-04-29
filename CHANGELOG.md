# Changelog

All notable changes to `@isonia/app-core` are documented here.

`package.json.version` uses SemVer without a leading `v`. Git tags use the matching version with a leading `v`, and GitHub dependency refs may point at those tags.

## [Unreleased]

### Added

- Added this changelog for release tracking and future release notes.
- Runtime config now supports an ignored `isonia.config.local.json` override before falling back to `isonia.config.json`.

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

[Unreleased]: https://github.com/isoniaos/app-core/compare/v0.5.0-alpha.2...HEAD
[0.5.0-alpha.2]: https://github.com/isoniaos/app-core/releases/tag/v0.5.0-alpha.2
[0.1.0]: https://github.com/isoniaos/app-core/releases/tag/v0.1.0
