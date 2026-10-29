import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';

/**
 * YellowCard off-ramp config. The real off-ramp (Skip Go bridge + YC
 * directSettlement) is mainnet-only — sandbox has neither Skip routes nor YC
 * webhooks. The testnet worker (YC sandbox) is only for temporary smoke tests
 * of the create/KYC/momo flow with the Skip bridge skipped.
 */
const DEFAULT_WORKER_BY_NETWORK: Partial<Record<CHAIN_NETWORK_TYPE, string>> = {
  [CHAIN_NETWORK_TYPE.MAINNET]: 'https://yellowcard.worker.ixo.earth',
  [CHAIN_NETWORK_TYPE.TESTNET]: 'https://test.yellowcard.worker.ixo.earth',
};

export const YELLOWCARD_WORKER_API = (
  process.env.NEXT_PUBLIC_YELLOWCARD_WORKER_API ||
  DEFAULT_WORKER_BY_NETWORK[DefaultChainNetwork] ||
  'https://yellowcard.worker.ixo.earth'
).trim();

/** Skip Go API base — proxied through the worker so the Skip API key stays
 *  server-side. */
export const SKIP_API_URL = `${YELLOWCARD_WORKER_API}/skip`;

/** ixo mainnet chain-id — Skip's `sourceAssetChainId`. The off-ramp only works
 *  on this network. */
export const IXO_CHAIN_ID = 'ixo-5';

/** Injective USDC on ixo (`ibc/77C1…55E6`, ixo ⇄ injective-1 over
 *  channel-31 — Circle's own mint on Injective). The canonical ixo USDC: the
 *  pay-convert oracle pays it on mainnet since 2026-10-29, and the off-ramp
 *  bridges it ixo → injective-1 → Injective EVM → Base (CCTP v2). Skip's
 *  default `sourceAssetDenom`. */
export const IXO_INJECTIVE_USDC_DENOM = 'ibc/77C12480BD8C29BF0ACEC2143736C15BAF8CD232CA27BAE09336677B828955E6';

/** Noble USDC on ixo (`ibc/6BBE…F97B`, ixo ⇄ noble-1 over channel-26). What
 *  users held before pay-convert switched to Injective USDC; Circle is
 *  retiring it. Still readable and withdrawable (ixo → noble-1 → Base), and
 *  on-ramp deliveries / refund returns still arrive in it (the worker has no
 *  single-tx Base → ixo route for Injective USDC). */
export const IXO_NOBLE_USDC_DENOM = 'ibc/6BBE9BD4246F8E04948D5A4EEE7164B2630263B9EBB5E7DC5F0A46C62A2FF97B';

/** The default ixo USDC denom (Skip's `sourceAssetDenom` when the screen
 *  passes none). */
export const IXO_USDC_DENOM = IXO_INJECTIVE_USDC_DENOM;

/** Every USDC denom a user may hold on ixo mainnet — canonical first. A
 *  withdrawal spends ONE of them (one IBC transfer, one Skip route). */
export const IXO_USDC_DENOMS: readonly string[] = [IXO_INJECTIVE_USDC_DENOM, IXO_NOBLE_USDC_DENOM];

/** Skip's chain id for Injective's EVM — the CCTP v2 leg of the Injective
 *  USDC route. Skip requires a 0x address for it; the worker supplies it
 *  (`bridge_addresses`), never the app. */
export const INJECTIVE_EVM_SKIP_CHAIN_ID = '1776';

/** PAY — ixo's liquid-staking token (native `upay`, 6 decimals, 1 PAY = 1 USDC).
 *  World Cleanup Day rewards are paid in it. Not Skip-routable: the off-ramp
 *  can't move it until the PAY → USDC conversion ships (see constants/cleanup). */
export const IXO_PAY_DENOM = 'upay';

/**
 * Off-ramp destination: Base (cheapest/fastest EVM CCTP leg YC supports).
 * `cryptoNetwork` is what YC expects; `skipChainId`/`skipDenom` are what Skip
 * routes to (chain 8453, native USDC, checksummed denom).
 */
export const OFFRAMP_DESTINATION = {
  cryptoNetwork: 'BASE',
  skipChainId: '8453',
  skipDenom: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

/** Off-ramp end-states (mirror the worker). Anything else is still in-flight. */
export const TERMINAL_OFFRAMP_STATUSES = new Set([
  'completed',
  'failed',
  'expired',
  'refunded',
  'refund_failed',
  'cancelled',
]);

/** On-ramp end-states (mirror the worker). `delivered` = USDC arrived on ixo.
 *  `bridge_failed` is ops-parked (support will resolve it), so the UI treats it
 *  as no-longer-in-flight too. */
export const TERMINAL_ONRAMP_STATUSES = new Set([
  'delivered',
  'failed',
  'expired',
  'cancelled',
  'refunded',
  'refund_failed',
  'bridge_failed',
]);
