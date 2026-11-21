/**
 * The airtime swap: vouchers (1 voucher = R1 of South African airtime) for an
 * airtime PIN, through the airtime-voucher-worker. See docs/airtime-swap.md.
 *
 * `NEXT_PUBLIC_AIRTIME_VOUCHER_URL` is the worker's origin (no path). Unset or
 * blank hides the feature entirely: no wallet entry, and `/wallet/airtime`
 * sends the user back to the wallet. Everything else (the service's DID, the
 * swap limits, whether PINs are test PINs, the token) comes from the worker's
 * own answers, never from the environment. A NEXT_PUBLIC_ value is inlined at
 * build time, so changing it takes a rebuild.
 */
export const AIRTIME_VOUCHER_URL = (process.env.NEXT_PUBLIC_AIRTIME_VOUCHER_URL || '').trim().replace(/\/+$/, '');

export const AIRTIME_SWAP_ENABLED = AIRTIME_VOUCHER_URL !== '';

/** Where the swap screen lives. Under `/wallet`, so the dock keeps Wallet active. */
export const AIRTIME_SWAP_ROUTE = '/wallet/airtime';
