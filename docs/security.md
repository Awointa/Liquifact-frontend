# Security

## Wallet idle auto-disconnect

To reduce exposure on a shared or unattended machine, `WalletProvider` automatically
disconnects the wallet session after 15 minutes of inactivity.

- The idle timer resets on pointer, keyboard, and tab-visibility activity.
- 60 seconds before expiry, a toast warns the user that the session is about to
  end; any tracked activity during that window resets the timer and keeps the
  session alive — there is no separate button, since resuming activity itself
  cancels the disconnect.
- On expiry, the existing `disconnect()` path runs: the persisted snapshot in
  `localStorage` (`liquifact-wallet-snapshot`) is cleared and the UI reverts to
  the disconnected state, so `WalletStatus` never renders a stale address.
- No secrets or private keys are ever stored, per the existing wallet
  integration contract (`WALLET_INTEGRATION_CONTRACT.md`).