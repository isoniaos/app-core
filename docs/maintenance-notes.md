# Maintenance Notes

This file keeps current App Core maintenance themes that are not tied to an old release line.

## Open Themes

- Review remaining setup address rendering duplication and keep shared address primitives in use.
- Decide whether setup holder lists should stay raw or become checksum-normalized at input boundaries.
- Keep transaction lifecycle presentation consistent across setup execution, proposal creation, and proposal actions.
- Add richer metadata rendering only when a metadata service or resolver contract is actually available.
- Keep EIP-5792 wallet batching behind explicit capability checks until real wallet and chain support is verified.
- Keep future color-mode, typography, shell, shadow, layout, and address-state theme token additions coordinated through `@isonia/theme-default`.
- Improve governance graph layout only when current deterministic layout becomes insufficient.
- Keep the local ABI Proposal Action Builder focused on browser-local known
  contracts, typed calldata encoding, read-result chaining, and explicit
  authority-boundary copy. Future work remains needed for asset transfer
  builders, verified ABI imports, complex tuple/array types, and proposal
  detail/execution action draft handling.

Do not turn these notes into readiness claims. Promote an item into roadmap or implementation work only when it is explicitly scoped.
