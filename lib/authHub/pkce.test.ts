import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  base64UrlEncode,
  codeChallengeS256,
  createCodeVerifier,
  createState,
  isValidCodeVerifier,
  isValidState,
  savePendingSignIn,
  takePendingSignIn,
} from './pkce';
import { installFakeBrowser, type FakeBrowser } from './testing/fakeBrowser';

// RFC 7636 Appendix B.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('PKCE helpers', () => {
  it('matches the RFC 7636 Appendix B S256 vector', async () => {
    expect(await codeChallengeS256(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it('base64url-encodes without padding or +/', () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-');
    expect(base64UrlEncode(new Uint8Array([1]))).toBe('AQ');
  });

  it('makes 43-character verifiers and states from 32 random bytes, different every time', () => {
    const verifiers = new Set(Array.from({ length: 50 }, createCodeVerifier));
    const states = new Set(Array.from({ length: 50 }, createState));
    expect(verifiers.size).toBe(50);
    expect(states.size).toBe(50);
    for (const v of verifiers) {
      expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(isValidCodeVerifier(v)).toBe(true);
    }
    for (const s of states) expect(isValidState(s)).toBe(true);
  });

  it('refuses to hash an invalid verifier (never a plain fallback)', async () => {
    await expect(codeChallengeS256('short')).rejects.toThrow();
    await expect(codeChallengeS256('x'.repeat(129))).rejects.toThrow();
  });

  it('refuses to make a challenge without WebCrypto subtle', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    try {
      await expect(codeChallengeS256(RFC_VERIFIER)).rejects.toThrow(/secure/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('pending sign-in storage', () => {
  let browser: FakeBrowser;
  const NOW = 1_800_000_000_000;

  beforeEach(() => {
    browser = installFakeBrowser('https://jambo.test/auth');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a sign-in under its state and hands it out once', () => {
    const state = createState();
    const verifier = createCodeVerifier();
    savePendingSignIn({ state, verifier, returnTo: '/entities/did:ixo:abc?tab=1' }, NOW);

    expect(takePendingSignIn(state, NOW + 1000)).toEqual({ state, verifier, returnTo: '/entities/did:ixo:abc?tab=1' });
    // Single use: a replayed callback finds nothing.
    expect(takePendingSignIn(state, NOW + 2000)).toBeNull();
    expect(browser.localStorage.length).toBe(0);
  });

  it('finds nothing for another, missing or malformed state', () => {
    const state = createState();
    savePendingSignIn({ state, verifier: createCodeVerifier(), returnTo: null }, NOW);
    expect(takePendingSignIn(createState(), NOW)).toBeNull();
    expect(takePendingSignIn(null, NOW)).toBeNull();
    expect(takePendingSignIn('fake', NOW)).toBeNull();
    expect(takePendingSignIn(`${state}x`.replace(/[^A-Za-z0-9_-]/g, '.'), NOW)).toBeNull();
    // The real one is still there.
    expect(takePendingSignIn(state, NOW)?.state).toBe(state);
  });

  it('keeps sign-ins started in two tabs apart', () => {
    const a = { state: createState(), verifier: createCodeVerifier(), returnTo: null };
    const b = { state: createState(), verifier: createCodeVerifier(), returnTo: null };
    savePendingSignIn(a, NOW);
    savePendingSignIn(b, NOW + 1);
    expect(takePendingSignIn(a.state, NOW + 2)?.verifier).toBe(a.verifier);
    expect(takePendingSignIn(b.state, NOW + 3)?.verifier).toBe(b.verifier);
  });

  it('expires after 30 minutes and deletes the expired entry on read', () => {
    const state = createState();
    savePendingSignIn({ state, verifier: createCodeVerifier(), returnTo: null }, NOW);
    expect(takePendingSignIn(state, NOW + 30 * 60 * 1000 + 1)).toBeNull();
    expect(browser.localStorage.length).toBe(0);
  });

  it('prunes expired entries and keeps only the newest five on start', () => {
    const states = Array.from({ length: 7 }, createState);
    states.forEach((state, i) => savePendingSignIn({ state, verifier: createCodeVerifier(), returnTo: null }, NOW + i));
    expect(browser.localStorage.length).toBe(5);
    expect(takePendingSignIn(states[0], NOW + 10)).toBeNull();
    expect(takePendingSignIn(states[6], NOW + 10)).not.toBeNull();

    browser.localStorage.setItem('ixo_auth_hub_pending:junk', 'not json');
    browser.localStorage.setItem('unrelated', 'kept');
    savePendingSignIn({ state: createState(), verifier: createCodeVerifier(), returnTo: null }, NOW + 31 * 60 * 1000);
    expect(browser.localStorage.getItem('ixo_auth_hub_pending:junk')).toBeNull();
    expect(browser.localStorage.getItem('unrelated')).toBe('kept');
    expect(browser.localStorage.length).toBe(2);
  });

  it('nulls a malformed stored verifier or return path instead of trusting storage', () => {
    const state = createState();
    browser.localStorage.setItem(
      `ixo_auth_hub_pending:${state}`,
      JSON.stringify({ state, verifier: 'short', returnTo: '//evil.example', ts: NOW }),
    );
    expect(takePendingSignIn(state, NOW)).toEqual({ state, verifier: null, returnTo: null });
  });

  it('refuses to start with an invalid state or verifier', () => {
    expect(() => savePendingSignIn({ state: 'fake', verifier: createCodeVerifier(), returnTo: null })).toThrow();
    expect(() => savePendingSignIn({ state: createState(), verifier: 'short', returnTo: null })).toThrow();
  });

  it('stores only a safe return path', () => {
    const state = createState();
    savePendingSignIn({ state, verifier: createCodeVerifier(), returnTo: '/\t/evil.example' }, NOW);
    expect(takePendingSignIn(state, NOW)?.returnTo).toBeNull();
  });
});
