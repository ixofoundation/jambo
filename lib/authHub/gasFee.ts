import type { StdFee } from '@cosmjs/stargate';

/**
 * How the app sizes a transaction's gas and fee. Pure; the chain calls live in
 * `signAndBroadcast.ts`.
 *
 * The limit normally comes from simulating the exact transaction (TxBody
 * including the smart-account TxExtension) and adding headroom. Only when the
 * simulation itself fails does the app fall back to a fixed per-message
 * estimate, or the caller's own limit.
 */

/** The price every transaction pays: 0.035 uixo per unit of gas, kept in milli-uixo so the fee is exact. */
export const GAS_PRICE_MILLI_UIXO = 35;

/** Headroom over the simulated gas: the simulation skips signature checks, and state can differ at inclusion. */
export const SIMULATED_GAS_MULTIPLIER = 1.5;

/** The fallback estimate per message, before the fallback multiplier. */
export const FALLBACK_GAS_PER_MESSAGE = 250_000;
export const FALLBACK_GAS_MULTIPLIER = 1.7;

/** The fee for a gas limit, at the app's gas price. */
export function feeForGas(gas: number): StdFee {
  const gasLimit = Math.ceil(gas);
  return {
    amount: [{ denom: 'uixo', amount: String(Math.ceil((gasLimit * GAS_PRICE_MILLI_UIXO) / 1000)) }],
    gas: String(gasLimit),
  };
}

/** The gas limit to ask for when the chain simulated `gasUsed`. */
export function gasFromSimulation(gasUsed: number): number {
  if (!Number.isFinite(gasUsed) || gasUsed <= 0) throw new Error(`Simulation reported no gas used (${gasUsed})`);
  return Math.ceil(gasUsed * SIMULATED_GAS_MULTIPLIER);
}

/**
 * The gas limit when the simulation failed: the caller's own limit if it gave
 * one, else the fixed estimate per message.
 */
export function fallbackGas(messageCount: number, gasLimit?: number): number {
  if (gasLimit && gasLimit > 0) return Math.ceil(gasLimit);
  return Math.ceil(messageCount * FALLBACK_GAS_PER_MESSAGE * FALLBACK_GAS_MULTIPLIER);
}
