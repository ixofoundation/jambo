import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';

/**
 * USDC on ixo. Everything NEW — withdrawals (YellowCard off-ramp), deposits, the
 * PAY → USDC conversion payout — uses ONE denom: Injective USDC
 * (`transfer/channel-31/erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a`).
 * Users only ever see it as "USDC".
 *
 * Legacy Noble USDC (`transfer/channel-26/uusdc`) is no longer accepted by any
 * new flow. Jambo still READS it, only to (a) count it in the one USDC total and
 * (b) offer the one-tap upgrade to Injective USDC (hooks/useUsdcUpgrade) before
 * it stops working on `USDC_UPGRADE_DEADLINE`. The UI calls that "upgrading your
 * USDC" — never "Noble" / "Injective".
 *
 * Axelar USDC (`ibc/2658C97F…`) is deliberately NOT here: not counted, not
 * labelled as USDC.
 *
 * Testnet/devnet have no USDC: no withdrawable denom and no legacy ones (so no
 * upgrade notice). The off-ramp's testnet test mode reads the conversion
 * oracle's payout denom (IXO) in USDC's place instead.
 */

/** Injective USDC on ixo mainnet — the only USDC withdrawn, deposited and paid out. */
export const INJECTIVE_USDC_DENOM = 'ibc/77C12480BD8C29BF0ACEC2143736C15BAF8CD232CA27BAE09336677B828955E6';

/** Legacy Noble USDC on ixo mainnet — counted in the balance and upgraded, never withdrawn. */
export const NOBLE_USDC_DENOM = 'ibc/6BBE9BD4246F8E04948D5A4EEE7164B2630263B9EBB5E7DC5F0A46C62A2FF97B';

/**
 * The smallest legacy balance offered for upgrade: 0.01 USDC (base units). Below it Skip
 * routes the swap through pools the shared memo rules do not cover (seen 30 Oct 2026 for
 * 100–1,000 base units), so dust never shows the notice or holds up a withdrawal.
 */
export const MIN_UPGRADE_MICRO = BigInt(10_000);

/** When legacy USDC stops working (Circle retires USDC on Noble) — shown in the upgrade notice. */
export const USDC_UPGRADE_DEADLINE = '12 January 2027';

interface UsdcRegistry {
  /** The ONE withdrawable USDC denom, or null where there is no USDC. */
  usdc: string | null;
  /** Legacy USDC denoms: counted in the total, offered for upgrade. */
  legacy: readonly string[];
}

const REGISTRY_BY_NETWORK: Record<CHAIN_NETWORK_TYPE, UsdcRegistry> = {
  [CHAIN_NETWORK_TYPE.MAINNET]: { usdc: INJECTIVE_USDC_DENOM, legacy: [NOBLE_USDC_DENOM] },
  [CHAIN_NETWORK_TYPE.TESTNET]: { usdc: null, legacy: [] },
  [CHAIN_NETWORK_TYPE.DEVNET]: { usdc: null, legacy: [] },
  [CHAIN_NETWORK_TYPE.LOCAL]: { usdc: null, legacy: [] },
};

const REGISTRY: UsdcRegistry = REGISTRY_BY_NETWORK[DefaultChainNetwork] ?? { usdc: null, legacy: [] };

/** The ONE USDC denom on this build's network (null off mainnet). */
export const USDC_DENOM: string | null = REGISTRY.usdc;

/** Legacy USDC denoms on this build's network (empty off mainnet). */
export const LEGACY_USDC_DENOMS: readonly string[] = REGISTRY.legacy;

/** Any USDC denom this build counts as the user's USDC (the withdrawable one or a legacy one). */
export function isUsdcDenom(denom: string): boolean {
  return denom === USDC_DENOM || LEGACY_USDC_DENOMS.includes(denom);
}
