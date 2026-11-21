# Airtime swap

A user swaps airtime vouchers for an airtime PIN. A voucher is an IXO 1155 token worth R1 of South African airtime; claim collections pay them out. The PIN is an AllNet PIN that works on Vodacom, MTN, Telkom and Cell C.

The service behind it is the airtime voucher worker (`ixoworld/airtime-voucher-worker`). Its README, section "Redemption", is the contract; `lib/airtimeVoucher/types.ts` is a copy of the types Jambo uses.

## Set-up

| Variable                          | Meaning                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_AIRTIME_VOUCHER_URL` | The worker's origin, without a path. Blank hides the feature: no "Get airtime" row in the wallet, and `/wallet/airtime` goes back to the wallet. |

Nothing else is configured here. The service's DID, the smallest and largest swap, and whether PINs are test PINs come from the worker's `GET /api`. The token comes from the swap answers.

The worker must list the app's origin in its `CORS_ORIGINS`.

## The flow

The screen is `/wallet/airtime` (`screens/airtimeSwap.tsx`, driven by `hooks/useAirtimeSwap.ts`). The wallet links to it.

1. **Amount.** Whole rands, within the service's limits. Nothing is asked of the service yet.
2. **Confirm.** The screen says what will be used up and that it cannot be undone.
3. **Ask.** `POST /api/swaps { amount }`. The answer is the swap (its one-time reference, valid 15 minutes) and the burn to sign. The swap is saved on the device before anything is signed.
4. **Burn.** One `MsgTransferCredit`, signed through the app's usual transaction path (`useAuth().onSign`). Before signing, `checkSwapBurn` checks that the owner is the user, the reason is `airtime-swap`, the reference is the swap's, and the vouchers add up to the confirmed amount. If not, nothing is signed. The transaction hash is saved after signing and before broadcast.
5. **Redeem.** `POST /api/swaps/{id}/redeem { txHash }`, repeated while the service answers 202. 200 carries the PIN.
6. **PIN.** Shown large, with a copy button, the code to dial (a `tel:` link) and the service's instructions. A test PIN says so and has no code to dial.

Confirm comes before ask on purpose. A reference that runs out unburned costs the user a wait (`swap_cooldown`), so the service is asked only once the user has committed.

## What each call carries

Each call to a swap route carries its own token (`lib/airtimeVoucher/swapToken.ts`): a UCAN issued by the user's `did:ixo:<address>` with their Ed25519 key, to the service's DID, for `airtime-voucher/swap` on `ixo:airtime-voucher:<address>`, valid 2 minutes, with the facts `nonce`, `method` and `path` of that one request. A token is used once; a repeated call signs a new one.

The service checks the token against the Ed25519 key in the user's DID document on chain. The hook registers the key when it is missing (`ensureEd25519OnChain`, one transaction, the same as the email notifier does).

## States

The user's swaps are kept in localStorage, per account, under `jambo.airtimeSwap.<address>` (`lib/airtimeVoucher/swapStore.ts`). The record survives a reload, a closed tab and a sign-out. It holds the swap's id, reference, amount, expiry, the vouchers to burn, the transaction hash and the service's status. It never holds the PIN: the PIN is read from the service each time it is shown.

| Stored swap needs | Meaning                                                 | What the screen does                                  |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `ready`           | Open, nothing signed, time left                         | Shows the confirm step for that swap                  |
| `burn_sent`       | A burn was signed; the service has not confirmed it     | Redeems with the stored hash. Never signs again       |
| `owed`            | The burn is verified; the PIN is not issued yet         | Shows the service's own message and "Check again"     |
| `pin`             | Fulfilled                                               | Reads the PIN from the service                        |
| `flagged`         | The burn did not match the swap                         | Says an operator will look at it, shows the reference |
| `open_elsewhere`  | Open at the service, but this device has no burn for it | Says when it runs out                                 |
| `expired`         | Ran out with nothing signed                             | Back to the amount step                               |

On arrival the screen goes straight to the newest unfinished swap.

### Never burning twice

`canSignBurn` is the only gate to signing: the swap is open, this device has its burn, nothing was signed for it, and at least a minute is left before it runs out. Once a transaction is signed, the swap is only ever redeemed, with two exceptions where the burn provably did not happen:

- the chain refused the transaction before broadcast (`SignBroadcastError` stage `not_sent`);
- the transaction is in a block with a failure code (stage `failed_on_chain`, or the service's `swap_burn_failed`).

A time-out or a lost connection after signing is not one of them. The outcome is unknown, so the swap is redeemed until the service sees the burn.

## Refusals

`lib/airtimeVoucher/messages.ts` has the wording for every refusal. The service's own `message` is for developers and is not shown, except its fixed text about a PIN that is owed.

| Code                                               | The user is told                                   | Offered                   |
| -------------------------------------------------- | -------------------------------------------------- | ------------------------- |
| `swap_in_progress`                                 | A swap is already open                             | Open that swap            |
| `insufficient_vouchers`                            | How many vouchers they have                        | Choose another amount     |
| `insufficient_airtime_balance`                     | Airtime is not available right now                 | Choose another amount     |
| `swap_reserve_full`                                | Busy, nothing was taken                            | Try again                 |
| `swap_cooldown`                                    | An earlier swap ran out; how long to wait          | Try again after the wait  |
| `swaps_paused`                                     | Swaps are paused                                   | Back to wallet            |
| `swap_burn_failed`                                 | Nothing was used                                   | Try again (same swap)     |
| `swap_burn_invalid` with `flagged`, `swap_flagged` | An operator will look at it; the reference         | Back to wallet            |
| `swap_burn_invalid` without `flagged`              | Do not try again; the reference                    | Back to wallet            |
| `swap_already_redeemed`                            | (the swap is read instead)                         | The PIN                   |
| `pin_unavailable`                                  | The airtime is bought; the PIN cannot be shown now | Check again               |
| `rate_limited`                                     | How long to wait                                   | Try again, or check again |
| `chain_unavailable`, `provider_unavailable`        | The service is having trouble                      | Try again, or check again |

The client waits out a short 429 `rate_limited` by itself (`Retry-After`, at most 10 seconds, once). The redeem loop waits up to 65 seconds, twice.

## Identity verification

Where the service asks for it (`requires.kyc` in `GET /api`: on by default on testnet and mainnet, off on devnet), a swap request carries the user's identity credential in `kyc`. The hook reads it from the user's Vault exactly as the withdraw screen does (`waitForKycCredentialSource`, then `selectKycCredentialJwt` in `utils/approvePayment.ts`): the legacy KYC/AML Level 1 credential when they hold one, else the Self Identity Level 1 one. The service accepts either, for the user's own `did:ixo:<address>` only.

- **No credential:** the service is not asked. The user is told to verify first, with a button to `/profile/credentials/kyc`.
- **Vault unreadable:** that is not the same as holding none. The user is asked to try again.
- **Refused** (`kyc_expired`, `kyc_revoked`, `kyc_invalid`): the user is sent to verify again, and that credential is not offered again this session (`noteKycCredentialRejected`), so the next try sends their other one if they hold it.
- **`credential_check_unavailable`:** nothing was decided; try again.

All of this happens at the request, before anything is signed: no voucher is ever used up by a swap that identity then stops.

## Voucher balance

The wallet's "Get airtime" row and the amount step show what the user holds (`hooks/useVoucherBalance.ts`, `lib/airtimeVoucher/balance.ts`). It is read in two steps, with nothing signed:

1. `GET /api/vouchers` on the service: public, no token. It lists the service's voucher tokens with their contract and the ids of the batches minted through the service. The request uses the browser's own cache: the service answers with an ETag and `max-age=60`, so a repeat costs a "not modified" at most, and a new mint shows within about a minute.
2. One `batch_balance` query to each token's contract over `CHAIN_RPC_URL`, 50 ids at a time.

Only vouchers of the listed batches are counted, because only those can be swapped; a voucher of the same token minted elsewhere is left out. A read that fails shows no figure (the row keeps its plain text, and the amount step falls back to the count of the service's last answer): unknown is never shown as zero. The figure decides nothing: the service counts again when a swap is asked for.

## Limits of this version

- **A swap opened on another device** cannot be finished here: `GET /api/swaps/{id}` does not answer the burn to sign. It runs out by itself.
- **A burn that never lands.** If a signed burn is never seen by the chain, the swap stays under "Recent swaps" with "Check". The user can start a new swap once the old one has run out.

## Analytics

`airtime_swap_started`, `airtime_swap_burn_sent`, `airtime_swap_completed`, `airtime_swap_owed`, `airtime_swap_flagged`, `airtime_swap_refused`, `airtime_pin_viewed` (see [analytics.md](analytics.md)). No PIN, reference, swap id or transaction hash.

## Testing locally

Unit tests: `yarn test lib/airtimeVoucher`.
