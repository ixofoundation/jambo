import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from 'lib/authHub/testing/fakeBrowser';
import {
  clearPwaUserData,
  formatSavedAt,
  loadBalance,
  loadCollectionAuths,
  rememberBalance,
  rememberCollectionAuths,
} from './userData';

const ALICE = 'ixo1alice';
const BOB = 'ixo1bob';

describe('lib/pwa/userData', () => {
  let storage: MemoryStorage;
  let cacheDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new MemoryStorage();
    cacheDelete = vi.fn(async () => true);
    const caches = { delete: cacheDelete };
    vi.stubGlobal('caches', caches);
    vi.stubGlobal('window', { localStorage: storage, caches });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps the last balance with its time, for that address only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:42:00Z'));
    rememberBalance(ALICE, BigInt(12_345_678));

    expect(loadBalance(ALICE)).toEqual({ totalMicro: BigInt(12_345_678), at: Date.parse('2026-11-24T10:42:00Z') });
    // A different account on the same phone never sees it.
    expect(loadBalance(BOB)).toBeNull();
  });

  it('keeps amounts beyond Number precision exactly', () => {
    rememberBalance(ALICE, BigInt('9007199254740993'));
    expect(loadBalance(ALICE)?.totalMicro).toBe(BigInt('9007199254740993'));
  });

  it('ignores a corrupt saved balance', () => {
    storage.setItem('jambo-last-balance', '{"address":"ixo1alice","totalMicro":"not a number","at":1}');
    expect(loadBalance(ALICE)).toBeNull();
    storage.setItem('jambo-last-balance', 'not json');
    expect(loadBalance(ALICE)).toBeNull();
  });

  it('keeps collection roles per account and per collection', () => {
    rememberCollectionAuths(ALICE, '7', ['/ixo.claims.v1beta1.SubmitClaimAuthorization']);
    expect(loadCollectionAuths(ALICE, '7')).toEqual(['/ixo.claims.v1beta1.SubmitClaimAuthorization']);
    expect(loadCollectionAuths(ALICE, '8')).toEqual([]);
    expect(loadCollectionAuths(BOB, '7')).toEqual([]);
  });

  it('logout clears the balance, every saved role and the image cache, and nothing else', () => {
    rememberBalance(ALICE, BigInt(1));
    rememberCollectionAuths(ALICE, '7', ['admin']);
    rememberCollectionAuths(ALICE, '8', ['owner']);
    storage.setItem('jambo-pwa-install-dismissed-at', '123');

    clearPwaUserData();

    expect(loadBalance(ALICE)).toBeNull();
    expect(loadCollectionAuths(ALICE, '7')).toEqual([]);
    expect(loadCollectionAuths(ALICE, '8')).toEqual([]);
    expect(storage.getItem('jambo-pwa-install-dismissed-at')).toBe('123');
    expect(cacheDelete).toHaveBeenCalledWith('jambo-images-v1');
  });

  it('formats the saved time as time today, weekday this week, date before that', () => {
    const now = new Date(2026, 10, 24, 15, 0).getTime();
    const today = new Date(2026, 10, 24, 10, 42).getTime();
    const twoDaysAgo = new Date(2026, 10, 22, 9, 5).getTime();
    const lastMonth = new Date(2026, 9, 3, 9, 5).getTime();

    expect(formatSavedAt(today, now)).toMatch(/10.42/);
    expect(formatSavedAt(twoDaysAgo, now)).toMatch(/09.05|9.05/);
    expect(formatSavedAt(twoDaysAgo, now)).not.toBe(formatSavedAt(new Date(2026, 10, 24, 9, 5).getTime(), now));
    expect(formatSavedAt(lastMonth, now)).toMatch(/3/);
  });
});
