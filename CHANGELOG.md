# Changelog

All notable changes to Q-Wallets will be documented in this file.

## [1.3.8] - 2026-11-03

### Fixed

- Send Max now follows changes to the selected fee and wallet balance until the amount is edited manually, across all seven wallets.
- BTC, LTC and DOGE fee estimates and submissions use the same supported whole-satoshi-per-byte rate, including low and custom publisher rates. Send Max waits for a valid fee instead of reserving zero while fees load.
- DGB and RVN keep their default fee when opening a send dialog from the Address Book and reserve the selected slider fee consistently.
- DGB and RVN fee slider changes preserve the amount selection, allowing Max to recalculate and keeping manually entered amounts intact.
- Retry transient ARRR transaction-history requests once, and refresh incomplete recipient details after displaying the available history. Payment submission is not retried.

### Tests

- Added coverage for fee units, low and custom rates, Send Max updates and manual amount overrides.
- Added wallet-level checks for amount and fee submission across all seven wallets, balance refreshes and send-dialog resets.

## [1.3.7] - 2026-10-28

### Fixed

- Show the wallet host's actual ARRR send error instead of replacing every failure with a generic message. Keep failed-transfer details available for review and leave the error visible until dismissed.
- Handle returned error objects as failures and close the submitting dialog consistently. Report recipient-validation failures separately and preserve the draft when sending fails. No automatic payment retry is performed.

## [1.3.6] - 2026-10-28

### Fixed

- Validate ARRR transfer recipients and Address Book entries through the selected Core, accepting supported shielded addresses such as Ironwood without hardcoded prefix or length rules. Remove the 78-character transfer-field limit that truncated Ironwood addresses.
- Keep ARRR sending and contact saving disabled while address validation is pending or unavailable. Show translated validation status, ignore obsolete responses, and check the recipient again before handing a payment to the wallet host. Requires Core's `/crosschain/arrr/validateaddress` endpoint.

## [1.3.5] - 2026-08-09

### Fixed

- QORT addresses without a registered Qortal name can now be saved in the Address Book. The form explains that no name is registered, lets you type your own label, and no longer clears the address while you type it.
- Renaming an existing QORT contact whose address owns no registered name no longer wipes the address field.

## [1.3.4] - 2026-06-13

### Changed

- Redesigned the wallet hub as a full visual and UX overhaul, replacing the older boxed layout with a cinematic coin-led workspace, atmospheric backgrounds, refreshed wallet tabs, and a cleaner right-side Address Book panel.
- Unified the QORT, BTC, LTC, DOGE, DGB, RVN, and ARRR wallet pages around the same shared workspace structure.
- Reworked send dialogs so transfers are easier to understand and harder to misread, with recipient-first layouts, cleaner amount fields, better Max/fee placement, clearer loading states while recipient data is being confirmed, and a smoother send-to-contact flow.
- Modernized the Address Book into a more usable wallet companion, with easier add/edit/delete flows, QORT name search when creating contacts, duplicate-contact warnings, explicit address confirmation before saving, softer row styling, lighter table text, pastel avatars, improved search styling, and better sync feedback.
- Refined transaction tables with lighter headers, improved pagination options, exact dates after 24 hours, smoother row hover feedback, and fewer layout jumps.
- Stabilized Receive QR layout inside Qortal Hub so the right rail can open naturally without making the background atmosphere shift.
- Reduced unnecessary automatic QORT balance refreshes from every 1 minute to every 2.5 minutes while keeping manual refresh available.

### Added

- Receive QR dialogs now work consistently for every wallet, not only QORT.
- QORT Address Book name search now marks results that are already saved with an "already in list" label.
- Save protection now warns users when they try to add a contact before confirming the address.
- Address Book sync now recognizes when local contacts are returned to the last synced state.
- Before and after screenshots for the redesign preview. Click either thumbnail to enlarge.

[![Q-Wallets before redesign](/changelog/q-wallets-before-redesign.png)](/changelog/q-wallets-before-redesign.png) [![Q-Wallets after redesign](/changelog/q-wallets-after-redesign-1-3-3.png)](/changelog/q-wallets-after-redesign-1-3-3.png)

## [1.3.3] - 2026-06-06

### Added

- `calculateMaxSendable` utility that computes the "SEND MAX" amount in integer satoshi math and holds back a small safety buffer, avoiding floating-point boundary errors that triggered false "Insufficient funds" rejections from the host
- `SEND_MAX_SAFETY_BUFFER_SATS` constant (1000 sats) used as the SEND MAX safety margin

### Fixed

- BTC and DGB Bech32 address validation: corrected the regex charset to the bech32 alphabet (excludes `1`, `b`, `i`, `o`) and allowed variable address length (39–59 chars) so longer Bech32 addresses (e.g. P2WSH) validate correctly
- SEND MAX no longer prefills an amount that lands on or just above the spendable cutoff

### Changed

- All coin send pages (ARRR, BTC, DGB, DOGE, LTC, QORT, RVN) refactored to use the shared `calculateMaxSendable` utility

### Tests

- Added tests for `calculateMaxSendable`
- Expanded address validation tests covering BTC/DGB Bech32 charset and length cases

## [1.3.2] - 2026-03-06

### Fixed

- QDN address book check: added `coinType` field to published QDN resources and dual validation in `fetchFromQDN` to discard resources returned by the Qortal node for a different coin identifier. Primary check uses the new top-level `coinType` field; secondary check uses entries' `coinType` field for backward compatibility with older published resources.
- TypeScript build errors for MUI v7 compatibility: replaced removed named exports (`SlideProps`, `TooltipProps`, `TransitionProps`, `SnackbarCloseReason`, `ToggleButtonGroupProps`) with `ComponentProps<typeof ...>` equivalents or local type definitions; added explicit `Theme` typing to `styled()` callbacks.
- `NumericFormat` forwarded MUI props no longer cause TypeScript errors.

### Tests

- Added 4 tests covering the QDN coinType mismatch scenario.

## [1.3.1] - 2026-02-27

### Fixed

- QDN address book sync: skip unnecessary publish when timestamps diverge but content is identical (hash comparison before publishing)
- QDN address book sync: re-align local timestamp to QDN after skipping publish, and sync forward after publishing, to avoid redundant evaluations on next startup

### Changed

- Release workflow now fails with a clear message if the release version already exists, instead of silently deleting it
- Removed push trigger from npm tests workflow

### Tests

- Added tests covering the QDN address book hash-comparison sync bugfix

## [1.3.0] - 2026-01-23

### Added

- Address book feature with QDN persistence
- QORT address search by name
- Double-click to copy address or add name to address book
- Validation functions for all coin addresses
- `maxSendable` functions for all supported coins (ARRR, BTC, DOGE, LTC, RVN, DGB)
- Tests for LTC validation
- New translations for address book
- Add CHANGELOG.md file
- Display changelog in a dialog

### Changed

- Updated qapp-core to version 1.0.75
- Improved I18N translations

## [1.2.1] - 2026-01-02

### Changed

- Improved send validation flow
- Updated GitHub Actions release workflow with simplified changelog template
- Added concurrency groups to GitHub Actions workflows
- Added condition to run workflows only on specific repository

### Fixed

- Send max button validation improvements

## [1.2.0] - 2025-12-27

### Changed

- Qortal Transaction table updates and improvements
- GitHub Actions parametrization of APP_NAME
- Improved release changelog diff with comparison links

## [1.1.3] - 2025-12-24

### Added

- GitHub Actions release workflow with automated changelog generation
- New contributors section in releases
- ASSET type transactions support

### Changed

- Improved API call for validating addresses (allows sending QORT to addresses with no transactions)
- Refactored wallet info loading with better async operations
- Added `useCallback` and `AbortController` for cleaner code

### Fixed

- Address validation for empty or malformed addresses

## [1.1.2] - 2025-11-28

### Added

- Font optimization with woff2 format and font-display swap
- Copy confirmation message
- Better precision for numeric values

### Changed

- Improved mobile responsiveness and layout
- Better loading states with LinearProgress
- Refactored embedded colors into theme
- Trimmed recipient address input
- More efficient async/await calls

### Fixed

- Mobile view for menu
- Modal reset after sending
- Address and amount validation
- Error reset when changing pages

## [1.1.1] - 2025-11-24

### Fixed

- Missing QORT import
- Duplicated check conditions
- Renamed methods for clarity
- Added EMPTY_STRING constant for consistency

## [1.1.0] - 2025-11-15

### Added

- Initial release of Q-Wallets
- Support for multiple cryptocurrencies: QORT, BTC, LTC, DOGE, DGB, RVN, ARRR
- Transaction history with pagination
- Send functionality for all supported coins
- QR code generation for receiving addresses
- Internationalization (i18n) support
- Responsive design for mobile devices
- Transaction fee display
- Copy to clipboard functionality

### Changed

- Refactored time constants
- Improved lateral menu responsiveness
- Better layout adaptation for different devices
