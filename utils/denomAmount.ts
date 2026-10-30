import { isUsdcDenom } from '@constants/usdc';

/**
 * Display ↔ base-unit amounts for the denoms an evaluator can pay out in.
 * Pure string math (no floating point), unit-tested in denomAmount.test.ts.
 *
 *  - `uixo` → IXO, 6 decimals;
 *  - any USDC denom this build counts (constants/usdc: the withdrawable one or a
 *    legacy one) → 'USDC', 6 decimals — users never see which kind;
 *  - anything else → shown as the raw denom, unscaled (0 decimals), as before.
 *
 * The denom itself is never rewritten: a collection keeps paying in the denom it
 * names.
 */

export interface DenomDisplay {
  /** What to show next to the amount. */
  symbol: string;
  decimals: number;
}

export function denomDisplay(denom: string): DenomDisplay {
  if (denom === 'uixo') return { symbol: 'IXO', decimals: 6 };
  if (isUsdcDenom(denom)) return { symbol: 'USDC', decimals: 6 };
  return { symbol: denom, decimals: 0 };
}

/** Base units → display string ('1500000', 6 → '1.5'). Non-integer input is returned as-is. */
export function baseToDisplay(base: string, decimals: number): string {
  if (!/^\d+$/.test(base) || decimals <= 0) return base;
  const padded = base.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, '');
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/** Display string → base units ('1.5', 6 → '1500000'). Digits past `decimals` are
 *  dropped (rounded down — never pay more than typed). Null for anything that is
 *  not a plain non-negative decimal. */
export function displayToBase(display: string, decimals: number): string | null {
  const v = display.trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(v)) return null;
  const [wholeRaw, fracRaw = ''] = v.split('.');
  const frac = fracRaw.slice(0, Math.max(0, decimals)).padEnd(Math.max(0, decimals), '0');
  const digits = `${wholeRaw || '0'}${frac}`.replace(/^0+(?=\d)/, '');
  return digits;
}
