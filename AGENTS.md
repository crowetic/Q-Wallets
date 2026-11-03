# AGENTS.md

Notes for AI agents working in this repository. Human-facing product docs live in
[README.md](README.md); user-visible changes go in [CHANGELOG.md](CHANGELOG.md).

## Repository location

The canonical checkout is `/home/crowetic/git-repos/crowetic/Q-Wallets`.
The legacy `/home/crowetic/git-repos/main-Q-Apps/Q-Wallets` path is a symlink to
this checkout. Make changes here instead of creating a second copy.

The owner's convention is to keep primary GitHub repositories under
`/home/crowetic/git-repos/crowetic/<project>` and primary Gitea repositories
under `/home/crowetic/git-repos/gitea/`, using their established namespace.

## What this app is

Q-Wallets is a **Qortal Q-App**: a React SPA that is published to QDN and rendered
inside the Qortal core UI (in an iframe). It is a multi-chain wallet front-end for
QORT, BTC, LTC, DOGE, DGB, RVN and ARRR.

Consequences that shape almost every design decision:

- **There is no backend and no build-time API.** Every privileged operation
  (balances, transactions, sending, encryption, QDN publish) goes through the global
  `qortalRequest({ action: ... })` bridge provided by the host. It is declared in
  [src/global.d.ts](src/global.d.ts) and used **without importing anything**.
- **No private keys ever live in this codebase.** Signing happens in Qortal core.
- **The host controls theme, language and base path** via `window._qdnTheme`,
  `window._qdnLang`, `window._qdnBase`, and `postMessage` events
  (`NAVIGATE_TO_PATH`, `THEME_CHANGED`, `LANGUAGE_CHANGED`) — see
  [src/hooks/useIframeListener.tsx](src/hooks/useIframeListener.tsx).
- **Persistent user data is localStorage + encrypted QDN**, never a server.
- Running the app outside Qortal core is only partially useful: `npm run dev` boots
  the UI, but anything touching `qortalRequest` fails. Prefer verifying behaviour
  with unit tests over trying to run the app.

Actions currently used: `GET_USER_ACCOUNT`, `GET_USER_WALLET`, `GET_WALLET_BALANCE`,
`GET_USER_WALLET_TRANSACTIONS`, `SEND_COIN`, `GET_PRIMARY_NAME`, `OPEN_USER_LOOKUP`,
`ENCRYPT_DATA`, `DECRYPT_DATA`, `PUBLISH_QDN_RESOURCE`, `FETCH_QDN_RESOURCE`,
`GET_NODE_INFO`, `GET_NODE_STATUS`, `IS_USING_PUBLIC_NODE`,
`GET_CROSSCHAIN_SERVER_INFO`, `SET_CURRENT_FOREIGN_SERVER`, `GET_ARRR_SYNC_STATUS`.

## Commands

| Task           | Command                                     |
| -------------- | ------------------------------------------- |
| Dev server     | `npm run dev`                               |
| Type-check     | `npx tsc -b` (also the first half of build) |
| Build          | `npm run build`                             |
| Tests (agents) | `npx vitest run [path]`                     |
| Tests (watch)  | `npm test`                                  |
| Coverage       | `npm run test:coverage`                     |
| Lint           | `npm run lint` / `npm run lint:fix`         |
| Format         | `npm run format` / `npm run format:check`   |

- **`npm test` is `vitest` in watch mode** — in an interactive TTY it will not
  exit. Always use `npx vitest run` when running tests non-interactively.
- `npm run build` = `tsc -b && vite build`, then copies `CHANGELOG.md` into `dist/`
  (the in-app changelog viewer fetches it at runtime).
- CI ([.github/workflows/npm_tests.yml](.github/workflows/npm_tests.yml)) runs only
  `npm test` on PRs to `master` and `feature/**`. Lint/format are **not** gated by
  CI, so run them yourself before finishing.

## Stack

React 19 + TypeScript 5.8 (strict) · Vite 6 · MUI 7 (+ `@mui/lab`, `@toolpad/core`) ·
Emotion · Jotai · react-router 7 · react-i18next · `qapp-core` (Qortal Q-App SDK) ·
Vitest 4 + Testing Library.

## Layout

```text
src/
  main.tsx            React root: theme provider → wallet context → router
  AppWrapper.tsx      qapp-core <GlobalProvider> (appName, publicSalt, auth)
  AppLayout.tsx       Nav drawer, node status polling, session context, QDN startup sync
  routes/Routes.tsx   createBrowserRouter, basename = window._qdnBase
  pages/<coin>/       One self-contained page per coin (qort, btc, ltc, doge, dgb, rvn, arrr)
  components/
    WalletWorkspace/  Shared wallet shell: summary card, receive QR, address-book panel,
                      sync card, transaction lists (largest shared component)
    AddressBook/      Dialog, table, add/edit form, delete confirm, avatar palette
    ExternalSendForm.tsx  Shared send dialog body for the 6 non-QORT coins
    FeeManager.tsx    Fee selection UI (low/medium/high/custom)
    NameText.tsx      Renders Qortal names (handles invisible-character warnings)
  utils/              addressBookStorage, addressBookQDN, addressValidation,
                      qortalNodeApi, maxSendable, invisibleCharacters, Types
  hooks/              useRecommendedFees, useIframeListener
  state/global/       Jotai atoms (theme, QORT transaction filters)
  contexts/           walletContext (address, name, avatar, node info)
  common/             constants.ts, functions.ts
  i18n/               i18n.ts, processors.ts, locales/<lang>/core.json (11 languages)
  styles/             theme/, page-styles.tsx (styled MUI dialogs/cards/tables)
  test/               setup.ts (global mocks), test-utils.tsx (custom render)
```

## Architecture notes

**Session / auth.** `useAuth()` from `qapp-core` in `AppLayout` is the source of
truth for `address`/`name`/`avatarUrl`; it is mirrored into `walletContext` for the
rest of the tree. `useGlobal()` is used on the QORT page for the auth name.

**Coin pages are deliberately duplicated.** The six non-QORT pages
([btc](src/pages/btc/index.tsx), [ltc](src/pages/ltc/index.tsx),
[doge](src/pages/doge/index.tsx), [dgb](src/pages/dgb/index.tsx),
[rvn](src/pages/rvn/index.tsx), [arrr](src/pages/arrr/index.tsx)) are ~700-line
near-copies differing in fee constant, address validator, decimals and a few
coin-specific quirks (ARRR adds sync status and foreign-server selection). **A fix
in one almost always has to be applied to the other five** — grep across
`src/pages/*/index.tsx` before declaring a change complete. The QORT page
([src/pages/qort/index.tsx](src/pages/qort/index.tsx), ~5.7k lines) is the outlier:
it resolves addresses to primary names (module-level `addressToPrimaryName` cache +
`RequestQueueWithPromise(10)`), supports transaction-type filters persisted in a
Jotai `atomWithStorage`, and owns its own address-book sync UI.

**Address book storage** ([src/utils/addressBookStorage.ts](src/utils/addressBookStorage.ts)):
localStorage, one key per coin, scoped by the logged-in account address
(`q-wallets-addressbook-<accountScope>-<coin>`), with migration from the older
unscoped keys. `setAddressBookAccountScope()` must be set before reads. Mutations
dispatch the `ADDRESS_BOOK_STORAGE_EVENT` window event so open panels refresh.
Entries carry `favorite`, `favoriteAt` and `sortOrder` for pinning/drag reorder.

**Address book QDN sync** ([src/utils/addressBookQDN.ts](src/utils/addressBookQDN.ts)):
entries are base64-encoded, `ENCRYPT_DATA`-encrypted and published as
`DOCUMENT_PRIVATE` under identifier `q-wallets-addressbook-<coin>`. Startup sync runs
from `AppLayout` for all coins. Three extra localStorage flags drive the sync UI:
`...-sync-required`, `...-sync-baseline` (signature of the last clean state) and
`...-published` (last published hash, used to tell "QDN unavailable" from "nothing
published yet"). All QDN failures are swallowed and logged — localStorage keeps
working.

**Validation.** Per-coin regexes in
[src/utils/addressValidation.ts](src/utils/addressValidation.ts). The QORT pattern
`/^Q[1-9A-HJ-NP-Za-km-z]{33}$/` is additionally duplicated in
[AddressFormDialog.tsx](src/components/AddressBook/AddressFormDialog.tsx) and the
QORT page. Qortal names are also checked for invisible/spoofing characters via
[invisibleCharacters.ts](src/utils/invisibleCharacters.ts).

**Fees & max send.** `useRecommendedFees` fetches publisher-provided estimates
(with timeouts); per-coin fallback fee constants live in `common/constants.ts`.
`calculateMaxSendable` works in integer satoshis and holds back
`SEND_MAX_SAFETY_BUFFER_SATS` (1000) to avoid float-boundary "insufficient funds"
rejections from the host — do not "simplify" it back to float math.

## Conventions

- **Prettier is enforced through ESLint** (`prettier/prettier: error`): single
  quotes, 80-col print width, 2-space indent, semicolons, `es5` trailing commas, LF.
  Run `npm run format` before finishing.
- **TS is strict with `noUnusedLocals` / `noUnusedParameters`** — a leftover import
  fails the build, not just the lint. Several past commits are just "Remove unused
  import"; don't add to them.
- **No path aliases in app code.** `@/` resolves only in
  [vitest.config.ts](vitest.config.ts); `tsconfig` has no `paths`. Application
  imports are relative (`../../utils/...`).
- **Use the shared constants** in [src/common/constants.ts](src/common/constants.ts)
  instead of literals: `EMPTY_STRING`, `ONE_SPACE`, `TIME_*`, `QORT_1_UNIT`,
  `ADDRESSBOOK_*`, per-coin `*_FEE`.
- **MUI v7 API**: use `slots` / `slotProps` (`slotProps.input`, `slotProps.htmlInput`,
  `slots.transition`), not the deprecated `TransitionComponent` / `inputProps` /
  `InputProps` forms.
- **`sx` object keys are kept alphabetically sorted**, with theme-callback values
  (`(t: Theme) => ...`) for anything mode-dependent. Reusable styled components live
  in [src/styles/page-styles.tsx](src/styles/page-styles.tsx) — prefer them over new
  one-off dialogs.
- Components are exported function declarations or typed `React.FC` consts; utility
  modules export arrow consts (a recent commit converted exported functions to
  consts — follow the local file's style).

## i18n

**Read [.agents/skills/i18n/SKILL.md](.agents/skills/i18n/SKILL.md) before writing or
editing any user-visible string.** Summary:

- Single namespace `core`; locale files are eagerly glob-imported in
  [src/i18n/i18n.ts](src/i18n/i18n.ts), so **adding a key means adding it to all 11
  files** under [src/i18n/locales/](src/i18n/locales/) (ar, de, en, es, et, fr, it,
  ja, pt, ru, zh) — never by hand: use
  `python3 .agents/skills/i18n/i18n_add_keys.py <patch.json>`, then
  `i18n_apply_translations.py` to translate and `--audit` to verify.
- Legacy keys are stored **lowercase** and capitalized at the call site via custom
  post-processors: `t('core:key', { postProcess: 'capitalizeFirstChar' })` (also
  `capitalizeAll`, `capitalizeFirstWord`). Newer nested blocks (`wallet`, `send`,
  `filters`, `address_book_ui`, `app`) are stored in natural case with no
  post-processor — match the block you are editing.
- Never hardcode user-visible English in components.

## Testing

- Vitest + React Testing Library, `jsdom`, globals enabled.
  [src/test/setup.ts](src/test/setup.ts) mocks `localStorage`, `navigator.clipboard`
  and the whole `qapp-core` module (`Coin`, `useGlobal`, `RequestQueueWithPromise`).
- Tests go in a `__tests__/` folder next to the source, named `[filename].test.ts(x)`
  (see [.agents/commands/WRITE_TESTS.md](.agents/commands/WRITE_TESTS.md)).
- `qortalRequest` is a bare global: stub it per test with
  `vi.stubGlobal('qortalRequest', vi.fn())`.
- **Pitfall — mocked `useTranslation` must return a stable `t`.** Define
  `const t = (k: string) => k` _outside_ the `vi.mock` factory. An inline
  `t: (k) => k` gets a new identity every render; components whose effects depend on
  `t` (e.g. the QORT name-search effect in `AddressFormDialog`) then loop
  synchronously, blocking the event loop so even `--testTimeout` never fires and the
  run hangs with no output.
- Prefer `@testing-library/user-event` and role/label queries; the custom render in
  [src/test/test-utils.tsx](src/test/test-utils.tsx) wraps components in a MUI theme
  and a real i18n instance when you need one.

## Release

Version lives in `package.json`. Pushing to `master` runs
[.github/workflows/release.yml](.github/workflows/release.yml): build → zip `dist/`
→ GitHub release `v<version>`. **The job fails if that tag already exists**, so bump
the version and add a `CHANGELOG.md` entry in the same PR as any release-worthy
change. Work happens on `feature/**` branches merged into `master` by PR; commit
subjects are short and imperative ("Fix overlapping window", "Add tests").
