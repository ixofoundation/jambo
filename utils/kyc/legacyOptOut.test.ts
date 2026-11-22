import { describe, expect, it } from 'vitest';

import {
  LEGACY_LOOKUP_MAX_AGE_MS,
  clearLegacyOptOut,
  isLegacyKycSkipped,
  needsLegacyKycLookup,
  skipLegacyKyc,
} from './legacyOptOut';

const DID = 'did:ixo:ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';
const OTHER = 'did:ixo:ixo1other';

function memoryStore() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('leaving the old identity check', () => {
  it('is off until the person chooses it, then holds for that DID only', () => {
    const store = memoryStore();
    expect(isLegacyKycSkipped(DID, store)).toBe(false);
    expect(skipLegacyKyc(DID, store)).toBe(true);
    expect(isLegacyKycSkipped(DID, store)).toBe(true);
    expect(isLegacyKycSkipped(OTHER, store)).toBe(false);
  });

  it('can be undone, for that DID only', () => {
    const store = memoryStore();
    skipLegacyKyc(DID, store);
    skipLegacyKyc(OTHER, store);
    clearLegacyOptOut(DID, store);
    expect(isLegacyKycSkipped(DID, store)).toBe(false);
    expect(isLegacyKycSkipped(OTHER, store)).toBe(true);
    // Nothing to undo, no DID, no storage, storage that throws: all quiet.
    clearLegacyOptOut(DID, store);
    clearLegacyOptOut(null, store);
    clearLegacyOptOut(DID, null);
    clearLegacyOptOut(DID, {
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(store.items.size).toBe(1);
  });

  it('stores a flag and nothing else', () => {
    const store = memoryStore();
    skipLegacyKyc(DID, store);
    expect([...store.items.entries()]).toEqual([[`jambo.kyc.skipLegacy:${DID}`, '1']]);
  });

  it('reads as "not skipped" without a DID, without storage, or when storage throws', () => {
    const store = memoryStore();
    expect(skipLegacyKyc('', store)).toBe(false);
    expect(skipLegacyKyc(null, store)).toBe(false);
    expect(store.items.size).toBe(0);
    expect(isLegacyKycSkipped(DID, null)).toBe(false);
    expect(skipLegacyKyc(DID, null)).toBe(false);
    // No `window` in this test environment: the default store is absent.
    expect(isLegacyKycSkipped(DID)).toBe(false);

    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isLegacyKycSkipped(DID, broken)).toBe(false);
    expect(skipLegacyKyc(DID, broken)).toBe(false);
  });
});

describe('needsLegacyKycLookup', () => {
  const now = 1_800_000_000_000;

  it('asks when the server was never asked, or long ago', () => {
    expect(needsLegacyKycLookup({ inFlight: false }, now)).toBe(true);
    expect(needsLegacyKycLookup({ inFlight: false, lastPolledAt: null }, now)).toBe(true);
    expect(needsLegacyKycLookup({ inFlight: false, lastPolledAt: now - LEGACY_LOOKUP_MAX_AGE_MS }, now)).toBe(true);
    // A timestamp from the future (clock changed) is not trusted.
    expect(needsLegacyKycLookup({ inFlight: false, lastPolledAt: now + 60_000 }, now)).toBe(true);
  });

  it('does not ask again within a day of an answer, or while a check is in flight', () => {
    expect(needsLegacyKycLookup({ inFlight: false, lastPolledAt: now - 60_000 }, now)).toBe(false);
    expect(needsLegacyKycLookup({ inFlight: true }, now)).toBe(false);
  });
});
