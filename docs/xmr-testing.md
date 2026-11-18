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
   are supported; integrated addresses, memo, payment IDs and send-max are not.
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
replace an uncertain payment. This release does not enable QORT/XMR swaps. Their
protocol, recovery proof and coordinated AT approval are a separate milestone.
