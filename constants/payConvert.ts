/**
 * The PAY → USDC conversion oracle (ixoworld/pay-convert-oracle).
 *
 * World Cleanup Day rewards are paid in PAY (1 PAY = 1 USDC) and the off-ramp
 * can only move USDC, so the Withdraw screen first converts: the user sends
 * their PAY to the conversion deed and files a claim for the same amount of
 * USDC in ONE signed transaction; the oracle has the decision engine judge it
 * and the chain pays the USDC out. This is the oracle's URL, one per network
 * (build-time like every NEXT_PUBLIC_ var). Blank ⇒ conversion is off and the
 * Withdraw screen keeps holding PAY (constants/cleanup).
 */
export const PAY_CONVERT_ORACLE_URL = (process.env.NEXT_PUBLIC_PAY_CONVERT_ORACLE_URL || '').trim().replace(/\/+$/, '');

export const PAY_CONVERT_ENABLED = PAY_CONVERT_ORACLE_URL.length > 0;

/** PAY and its payout are both 6-decimal denoms: whole units ↔ base units. */
export const PAY_DECIMALS = 6;

export function toPayBase(amount: number): string {
  return Math.round(amount * 10 ** PAY_DECIMALS).toString();
}

export function fromPayBase(base: string): number {
  return Number(base) / 10 ** PAY_DECIMALS;
}
