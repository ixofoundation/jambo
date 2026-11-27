import { describe, expect, it } from 'vitest';

import { fallbackGas, feeForGas, gasFromSimulation } from './gasFee';

describe('feeForGas', () => {
  it('prices the gas limit in uixo and rounds both up', () => {
    expect(feeForGas(600_000)).toEqual({ amount: [{ denom: 'uixo', amount: '21000' }], gas: '600000' });
    expect(feeForGas(100_000.2)).toEqual({ amount: [{ denom: 'uixo', amount: '3501' }], gas: '100001' });
  });
});

describe('gasFromSimulation', () => {
  it('adds headroom over the simulated gas', () => {
    expect(gasFromSimulation(200_000)).toBe(300_000);
    expect(gasFromSimulation(1)).toBe(2);
  });

  it('refuses a simulation that reported no gas', () => {
    expect(() => gasFromSimulation(0)).toThrow(/no gas used/);
    expect(() => gasFromSimulation(NaN)).toThrow(/no gas used/);
  });
});

describe('fallbackGas', () => {
  it('estimates per message when the caller gave no limit', () => {
    expect(fallbackGas(1)).toBe(425_000);
    expect(fallbackGas(2)).toBe(850_000);
  });

  it("prefers the caller's own limit", () => {
    expect(fallbackGas(1, 600_000)).toBe(600_000);
    expect(fallbackGas(1, 0)).toBe(425_000);
  });
});
