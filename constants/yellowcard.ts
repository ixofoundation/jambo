import { CHAIN_IDS, CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';

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

/** ixo MAINNET chain-id — Skip's `sourceAssetChainId`. Deliberately the mainnet id
 *  on every build: Skip only routes from mainnet, and the off-ramp bridge only runs
 *  there (testnet test mode skips it). The USDC it bridges is constants/usdc
 *  `INJECTIVE_USDC_DENOM`. */
export const IXO_CHAIN_ID = CHAIN_IDS[CHAIN_NETWORK_TYPE.MAINNET];

/** Skip chain ids the off-ramp's Injective-USDC route may ask an address for (the
 *  CCTP V2 leg runs from Injective's EVM side, `1776`; `injective-1` in case Skip
 *  adds it).
 *  Their address is the YellowCard worker's refund wallet, read from
 *  `GET /offramp/config` — never derived from the user's ixo key. */
export const RECOVERY_CHAIN_IDS = ['1776', 'injective-1'] as const;

/** How long the client keeps treating a Skip `STATE_ABANDONED` ("tracking stalled")
 *  as still in transit before offering to re-send. UX only — the worker's cron is
 *  authoritative for the bridge outcome. */
export const BRIDGE_POLL_WINDOW_MS = 10 * 60 * 1000;

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
