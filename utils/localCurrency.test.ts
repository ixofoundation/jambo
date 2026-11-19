import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ loadKycPrefill: vi.fn(), loadOfframpProfile: vi.fn() }));

vi.mock('@utils/kycPrefill', () => ({ loadKycPrefill: h.loadKycPrefill }));
vi.mock('@utils/offrampProfile', () => ({ loadOfframpProfile: h.loadOfframpProfile }));

import { getLocalCurrency, initLocalCurrency } from './localCurrency';

const mx = {} as any;
const ROOM = '!room:mx.ixo.earth';

beforeEach(() => {
  h.loadOfframpProfile.mockReset().mockResolvedValue(null);
  h.loadKycPrefill.mockReset().mockResolvedValue({});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ rate: 18.5 }) })),
  );
});

describe('initLocalCurrency', () => {
  it('reads the country from the Vault only: the KYC prefill is asked to skip the Auth Hub', async () => {
    await initLocalCurrency(mx, ROOM, 'ixo1nohub');
    expect(h.loadKycPrefill).toHaveBeenCalledTimes(1);
    expect(h.loadKycPrefill).toHaveBeenCalledWith(mx, ROOM, undefined, { skipHub: true });
    expect(getLocalCurrency()).toBeNull();
  });

  it('still takes a legacy user’s country from their credential', async () => {
    h.loadKycPrefill.mockResolvedValue({ country: 'ZA' });
    await initLocalCurrency(mx, ROOM, 'ixo1legacy');
    expect(getLocalCurrency()).toEqual({ country: 'ZA', currency: 'ZAR', rate: 18.5 });
  });
});
