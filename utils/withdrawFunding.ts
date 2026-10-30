/**
 * How one withdrawal of `amountMicro` is funded. Pure (bigint math, no I/O) —
 * unit-tested in withdrawFunding.test.ts.
 *
 * The off-ramp only ever bridges the ONE withdrawable USDC denom (constants/usdc).
 * What can top it up: legacy USDC — only after the one-tap upgrade
 * (hooks/useUsdcUpgrade).
 *
 * The upgrade is asked for ONLY when the amount actually needs it: a withdrawal
 * the user can make right now is never held up by a 2-minute upgrade (the calm
 * notice under the balance still offers it).
 */

export type WithdrawFunding =
  /** The withdrawable USDC covers it. */
  | { kind: 'direct' }
  /** Covered only once the legacy USDC is upgraded ("One quick step before you withdraw"). */
  | { kind: 'upgrade_first' }
  /** More than everything together; `maxMicro` is that everything. */
  | { kind: 'insufficient'; maxMicro: bigint };

const ZERO = BigInt(0);

export function planWithdrawalFunding(params: {
  amountMicro: bigint;
  /** The withdrawable USDC. */
  usdcMicro: bigint;
  /** Legacy USDC that can be upgraded right now; 0 when there is none or no upgrade is offered. */
  upgradeableMicro: bigint;
}): WithdrawFunding {
  const { amountMicro, usdcMicro } = params;
  const upgradeableMicro = params.upgradeableMicro > ZERO ? params.upgradeableMicro : ZERO;
  const maxMicro = usdcMicro + upgradeableMicro;
  if (amountMicro <= ZERO || amountMicro > maxMicro) return { kind: 'insufficient', maxMicro };
  if (amountMicro <= usdcMicro) return { kind: 'direct' };
  return { kind: 'upgrade_first' };
}
