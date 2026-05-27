# Address Components

This note records the local address display and input surface in App Core.

## Shared Address Primitives

- `src/ui/address/address-utils.ts` provides address shortening, parsing, validation, normalization, and deduplication helpers.
- `src/ui/address/AddressAvatar.tsx` provides deterministic SVG identicons.
- `src/ui/address/AddressDisplay.tsx` provides shortened address display with avatar, tooltip/title, invalid state, and optional copy support.
- `src/ui/address/AddressInput.tsx` provides single-address validation states and optional checksum normalization on blur.
- `src/ui/address/MultiAddressInput.tsx` provides chip/tag editing, raw paste parsing, invalid item display, duplicate handling, and validation summaries.
- `src/ui/address/AddressChip.tsx` provides removable address chips for valid, invalid, and duplicate list items.
- `src/ui-kit/identity/IsoAddressDisplay.tsx` and `src/ui-kit/identity/IsoAddressAvatar.tsx` provide UI-kit identity primitives.

## Current Display Surfaces

- `src/utils/format.ts` owns non-React address formatting helpers.
- `src/utils/display-labels.ts` formats mandate holders and graph holder nodes.
- `src/wallet/WalletStatus.tsx` renders connected wallet addresses.
- Organization, governance structure, proposal, diagnostics, setup preview, and setup execution screens render configured addresses, actors, targets, holders, and transaction references.

## Current Input Surfaces

- `src/features/setup/SimpleDaoPlusDraftForm.tsx` includes organization admin, executor holder, and holder list inputs.
- `src/features/setup/shared/SimpleDaoPlusSetupWizardSteps.tsx` includes setup wizard metadata and holder inputs.
- `src/features/proposals/CreateProposalPage.tsx` renders proposal target inputs.

## Maintenance Notes

- Prefer shared address primitives over ad hoc string formatting in React components.
- Keep checksum normalization and duplicate handling explicit at form boundaries.
- Use `@isonia/theme-default` for address-state variables and reusable address token defaults.
- Keep concrete address component layout CSS in App Core until a broader reusable package contract is needed.
