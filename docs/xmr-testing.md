# Q-Wallets-TESTING: Monero stagenet

Build `npm ci && npm run build:testing` with Node 22. Testing mode sets the Q-App
identity to **Q-Wallets-TESTING**, retaining the existing public salt and all prior
coin pages. Publish a ZIP of the **contents** of `dist` (`index.html` at ZIP root)
as service `APP`, name `Q-Wallets-TESTING`. Publication is an owner action. Open
`qortal://APP/Q-Wallets-TESTING/monero` or choose Monero in the navigation.

Requirements: the matching desktop Hub `xmr-support` build with its native Monero
worker, and the matching ARRR+XMR Core JAR. The earlier address-only Hub AppImage
cannot scan/send. This first functional release supports Monero **stagenet** only.

For **Qortal mainnet + Monero stagenet**, add `"moneroNetwork":"STAGENET"` to the
Core's existing settings; keep `isTestNet` false/absent. Retain the prior
JAR/settings and apply through the owner's normal Core lifecycle. Verify
`/admin/info` reports `isTestNet:false`, `moneroNetwork:"stagenet"`. No live
configuration is changed by this build. Removing the override later restores
normal mainnet/mainnet and Qortal-testnet/Monero-stagenet selection; this first
Hub engine still refuses mainnet scans/spending.

1. Unlock the ordinary Qortal account in desktop Hub. Connect the XMR wallet and
   approve reads. Remembering the wallet-info permission avoids repeated polling
   prompts. Opening the native wallet requires an additional explicit approval.
2. For recovery/previously used wallets, leave **Restore height = 0**. A full scan
   can take a long time and download substantial data. For a new, never-used
   wallet, explicitly choose the current height. Earlier payments will be skipped.
3. Manually request worthless coins from the
   [stagenet faucet](https://faucet-stagenet.xmr.nodely.dev/). The operator's
   [guide](https://nodely.io/docs/monero/faucet/) describes proof of work, payout
   timing and claim limits. Wait for detection and unlocked balance.
4. Send a small amount to a second private stagenet wallet. Amount and maximum
   fee are decimal strings (up to 12 places). Hub checks the full address checksum
   and asks for approval before local signing. Standard addresses/subaddresses
   are supported. The Send button opens Hub approval. Fractional input such as
   `.05` is normalized to `0.05` without floating-point conversion. Send Max
   reserves the entire fee limit from unlocked funds and follows fee/balance
   changes until you edit the amount. Integrated addresses, memo and payment IDs
   are not supported.
   Check history and the receiving wallet's balance.
5. Close/reopen and compare address, balance and history. In a fresh Hub profile,
   restore only the ordinary Qortal backup and scan from 0 to recover prior funds.
6. Deny a payment and change account/Core during approval; no old-context payment
   should occur. An uncertain broadcast blocks new payments and permits only the
   same signed transaction/hash to be rebroadcast after approval. Never delete a
   pending journal to retry.

Default daemon: `https://xmr.nodely.dev:38089`, treated as untrusted by local
wallet2. Keys/view keys stay in Hub, but the operator can observe IP/timing and
broadcasts; this release is not an anonymity guarantee. Public daemon failover and
mobile/browser engines are deferred. No account secret or transaction metadata
may be exposed to this Q-App.

Rollback: republish your retained previous ZIP under the same testing name and
retain the prior Core JAR/settings and Hub AppImage. Preserve Hub's encrypted
cache/pending journal if a payment is unresolved; older wallets cannot safely
replace an uncertain payment. This release does not enable QORT/XMR cross-chain trades. Their
protocol, recovery proof and coordinated AT approval are a separate milestone.

Testing build **1.4.0-xmr.3** adds the shared Send dialog and XMR address book.
The summary's available balance is the unlocked balance; total balance and scan
progress remain visible. Errors identify the affected field inside the dialog.
History includes exact amounts/fees, confirmations, dates, pagination and hash
copying. The previously delivered matching Hub and Core can handle these standard
`SEND_COIN` requests; no new Hub/native engine or Core JAR is required for this
Q-App change.

For the send regression, enter `.05` and fee limit `0.001` with at least `0.051`
unlocked stagenet XMR. Expect a Hub approval showing `0.05` XMR and the correct
recipient. Also test a declined approval, a 13-decimal amount, insufficient
unlocked balance, Send Max after fee changes, and an unresolved pending payment.
Confirm any approved payment in both wallets. The automated tests mock the Hub
bridge and do not sign or broadcast a payment.

Testing build **1.4.0-xmr.4** retains these XMR changes and reviews Send Max across
all eight wallets. BTC, LTC, DOGE, DGB and RVN submit `sendMax: true` without an
`amount`; the current Hub plans the final payment from confirmed inputs and asks
for approval. The displayed amount is an estimate. Manual edits submit a normal
fixed amount. Older hosts that require an amount reject the new Max request;
there is no automatic fixed-amount fallback or payment retry.

ARRR requests `GET_WALLET_BALANCE` with `verified: true`. **This requires the new
matching Hub build** so that it asks the existing Core wallet-balance API for
`verified=true`; older Hub builds ignore this option and include pending funds.
No Core/JNI update or database migration is introduced by this Max fix. ARRR
retains its fixed fee and safety buffer. QORT requires a successfully fetched
network fee and refreshes it while the send dialog is open.

XMR Max remains conservative: unlocked balance minus the full maximum fee, using
12-decimal strings. If the actual fee is lower, unused reserve remains in the
wallet. Pending-payment, synchronization and Hub approval guards still apply.
No test run signs or broadcasts a payment using a real account.
