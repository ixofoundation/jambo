import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFakeBrowser, type FakeBrowser } from 'lib/authHub/testing/fakeBrowser';
import {
  clearLinkState,
  clearYref,
  handOffFromQuery,
  markHandOffBound,
  peekHandOff,
  peekYref,
  saveHandOff,
  shouldBind,
  takeHandOffFromUrl,
  wasHandOffBound,
} from './yomaLink';

const ENTRY = '/entities/[entityId]';
const DID = 'did:ixo:ixo1user';

let browser: FakeBrowser;
beforeEach(() => {
  browser = installFakeBrowser('https://jambo.test/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('takeHandOffFromUrl', () => {
  it('takes all three, unchanged, from the worker redirect into the entity page', () => {
    const { handOff, cleaned } = takeHandOffFromUrl(
      'https://jambo.test/entities/did:ixo:entity:abc?yref=p-1&ysig=c2ln_-%2B%2F%3D&yexp=1795714015&tab=2#x',
      ENTRY,
    );
    expect(handOff).toEqual({ yref: 'p-1', ysig: 'c2ln_-+/=', yexp: '1795714015' });
    expect(cleaned).toBe('/entities/did:ixo:entity:abc?tab=2#x');
  });

  it('an older, unsigned link: yref alone', () => {
    expect(takeHandOffFromUrl('https://jambo.test/entities/e?yref=p-1', ENTRY).handOff).toEqual({
      yref: 'p-1',
      ysig: null,
      yexp: null,
    });
  });

  it('any other page: nothing taken, but all three stripped', () => {
    const { handOff, cleaned } = takeHandOffFromUrl(
      'https://jambo.test/settings?yref=p-2&ysig=s&yexp=1&a=b',
      '/settings',
    );
    expect(handOff).toBeNull();
    expect(cleaned).toBe('/settings?a=b');
  });

  it('a ysig/yexp without yref is no hand-off', () => {
    const { handOff, cleaned } = takeHandOffFromUrl('https://jambo.test/entities/e?ysig=s&yexp=1', ENTRY);
    expect(handOff).toBeNull();
    expect(cleaned).toBe('/entities/e');
  });

  it('a repeated parameter counts as absent', () => {
    expect(takeHandOffFromUrl('https://jambo.test/entities/e?yref=a&yref=b&ysig=s', ENTRY).handOff).toBeNull();
    expect(takeHandOffFromUrl('https://jambo.test/entities/e?yref=a&ysig=s&ysig=t', ENTRY).handOff).toEqual({
      yref: 'a',
      ysig: null,
      yexp: null,
    });
  });

  it('nothing to do without the parameters', () => {
    expect(takeHandOffFromUrl('https://jambo.test/entities/e?tab=1', ENTRY)).toEqual({ handOff: null, cleaned: null });
  });
});

describe('handOffFromQuery (Next router.query)', () => {
  it('ignores arrays and empty values', () => {
    expect(handOffFromQuery({ yref: ['a', 'b'], ysig: 's' })).toBeNull();
    expect(handOffFromQuery({ yref: 'a', ysig: '', yexp: ['1', '2'] })).toEqual({ yref: 'a', ysig: null, yexp: null });
  });
});

describe('stored hand-off', () => {
  it('a newer hand-off replaces the older one whole, never a mix', () => {
    saveHandOff({ yref: 'p-1', ysig: 'sig-1', yexp: '100' });
    saveHandOff({ yref: 'p-2', ysig: null, yexp: null });
    expect(peekHandOff()).toEqual({ yref: 'p-2', ysig: null, yexp: null });
    expect(peekYref()).toBe('p-2');
  });

  it('clearYref clears all three together', () => {
    saveHandOff({ yref: 'p-1', ysig: 'sig-1', yexp: '100' });
    clearYref();
    expect(peekHandOff()).toBeNull();
    expect(browser.sessionStorage.length).toBe(0);
  });

  it('keeps the same lifetime as before (a day)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    saveHandOff({ yref: 'p-1', ysig: 'sig-1', yexp: '100' });
    vi.setSystemTime(24 * 60 * 60 * 1000 + 1);
    expect(peekHandOff()).toBeNull();
  });
});

describe('hand-off sent with a bind', () => {
  it('is remembered for exactly this DID and this hand-off', () => {
    const handOff = { yref: 'p-1', ysig: 'sig-1', yexp: '100' };
    expect(wasHandOffBound(DID, handOff)).toBe(false);
    markHandOffBound(DID, handOff);
    expect(wasHandOffBound(DID, handOff)).toBe(true);
    expect(wasHandOffBound('did:ixo:ixo1other', handOff)).toBe(false);
    expect(wasHandOffBound(DID, { ...handOff, ysig: 'sig-2' })).toBe(false);
  });

  it('is forgotten on logout (clearLinkState)', () => {
    const handOff = { yref: 'p-1', ysig: null, yexp: null };
    markHandOffBound(DID, handOff);
    clearLinkState();
    expect(wasHandOffBound(DID, handOff)).toBe(false);
  });
});

describe('shouldBind', () => {
  const handOff = { yref: 'pu-1', ysig: 'sig', yexp: '1900000000' };
  const fresh = { handOff: null, handOffSent: false, checkedThisSession: false };

  it('binds a DID that never bound', () => {
    expect(shouldBind({ email: null, yomaId: null, contact: null }, fresh)).toBe(true);
  });

  it('does not bind an email-bound DID again without a hand-off', () => {
    expect(shouldBind({ email: 'a@example.com', yomaId: null, contact: 'email' }, fresh)).toBe(false);
  });

  it('binds an unmatched DID once with a new hand-off, not again after sending it', () => {
    const status = { email: 'a@example.com', yomaId: null, contact: 'email' as const };
    expect(shouldBind(status, { ...fresh, handOff })).toBe(true);
    expect(shouldBind(status, { ...fresh, handOff, handOffSent: true })).toBe(false);
  });

  it('re-binds an unlinked phone-only account once per session (the worker refreshes its phone)', () => {
    const status = { email: null, yomaId: null, contact: 'phone' as const };
    expect(shouldBind(status, fresh)).toBe(true);
    expect(shouldBind(status, { ...fresh, checkedThisSession: true })).toBe(false);
  });

  it('never re-binds a linked account', () => {
    expect(shouldBind({ email: null, yomaId: 'pu-1', contact: 'phone' }, fresh)).toBe(false);
    expect(shouldBind({ email: 'a@example.com', yomaId: 'pu-1', contact: 'email' }, { ...fresh, handOff })).toBe(false);
  });
});
