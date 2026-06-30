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

/** USDC IBC denom on ixo (Skip's `sourceAssetDenom`). This is the canonical
 *  mainnet USDC, confirmed Skip-routable on ixo-5. A user may instead hold an
 *  alternate USDC denom; the screen passes whichever denom the balance actually
 *  uses, falling back to this. */
export const IXO_USDC_DENOM = 'ibc/6BBE9BD4246F8E04948D5A4EEE7164B2630263B9EBB5E7DC5F0A46C62A2FF97B';

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
export const TERMINAL_OFFRAMP_STATUSES = new Set(['completed', 'failed', 'expired', 'refunded', 'refund_failed', 'cancelled']);
