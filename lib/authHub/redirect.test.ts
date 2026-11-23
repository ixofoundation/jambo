import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFakeBrowser, type FakeBrowser } from './testing/fakeBrowser';

const HUB = 'https://test.auth.example';

/** redirect.ts reads its config at import, so import it fresh per env. */
async function loadRedirect(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_AUTH_HUB_URL', HUB);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value as string);
  const redirect = await import('./redirect');
  const pkce = await import('./pkce');
  return { ...redirect, ...pkce };
}

function startUrl(browser: FakeBrowser): URL {
  return new URL(browser.window.location.href);
}

let browser: FakeBrowser;
beforeEach(() => {
  browser = installFakeBrowser('https://jambo.test/auth');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('loginViaAuthHub', () => {
  it('redirect_uri and hide_mnemonic unchanged, plus state and an S256 challenge', async () => {
    const m = await loadRedirect({});
    await m.loginViaAuthHub();
    const url = startUrl(browser);

    expect(`${url.origin}${url.pathname}`).toBe(`${HUB}/api/auth/login`);
    expect(url.searchParams.get('redirect_uri')).toBe('https://jambo.test/auth/callback');
    expect(url.searchParams.get('hide_mnemonic')).toBe('true');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    // Nothing else is sent: this build has no organisation routing.
    expect(Array.from(url.searchParams.keys()).sort()).toEqual(
      ['code_challenge', 'code_challenge_method', 'hide_mnemonic', 'redirect_uri', 'state'].sort(),
    );

    const state = url.searchParams.get('state');
    const challenge = url.searchParams.get('code_challenge');
    expect(m.isValidState(state)).toBe(true);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // The stored verifier is the one the challenge was made from.
    const pending = m.takePendingSignIn(state);
    expect(pending?.state).toBe(state);
    expect(await m.codeChallengeS256(pending!.verifier!)).toBe(challenge);
  });

  it('hideMnemonic: false leaves hide_mnemonic out, still state + S256', async () => {
    const m = await loadRedirect({});
    const url = new URL(await m.prepareAuthHubLogin({ hideMnemonic: false }));
    expect(url.searchParams.has('hide_mnemonic')).toBe(false);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const pending = m.takePendingSignIn(url.searchParams.get('state'));
    expect(await m.codeChallengeS256(pending!.verifier!)).toBe(url.searchParams.get('code_challenge'));
  });

  it('keeps the parameter order and encoding of the existing URL (redirect_uri first, exact)', async () => {
    const m = await loadRedirect({});
    const href = await m.prepareAuthHubLogin();
    expect(
      href.startsWith(`${HUB}/api/auth/login?redirect_uri=https%3A%2F%2Fjambo.test%2Fauth%2Fcallback&state=`),
    ).toBe(true);
    expect(href.endsWith('&hide_mnemonic=true')).toBe(true);
  });

  it('a fresh state and verifier on every start', async () => {
    const m = await loadRedirect({});
    const a = new URL(await m.prepareAuthHubLogin());
    const b = new URL(await m.prepareAuthHubLogin());
    expect(a.searchParams.get('state')).not.toBe(b.searchParams.get('state'));
    expect(a.searchParams.get('code_challenge')).not.toBe(b.searchParams.get('code_challenge'));
  });

  it('carries the saved deep link next to the state', async () => {
    browser.sessionStorage.setItem('ixo_return_to', JSON.stringify({ path: '/entities/did:ixo:1', ts: Date.now() }));
    const m = await loadRedirect({});
    const url = new URL(await m.prepareAuthHubLogin());
    expect(m.takePendingSignIn(url.searchParams.get('state'))?.returnTo).toBe('/entities/did:ixo:1');
    // The tab's own copy stays for the callback to clear.
    expect(browser.sessionStorage.getItem('ixo_return_to')).not.toBeNull();
  });

  it('does not start (and does not navigate) when the sign-in cannot be secured', async () => {
    const m = await loadRedirect({});
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    await expect(m.loginViaAuthHub()).rejects.toThrow();
    expect(browser.window.location.href).toBe('https://jambo.test/auth');
  });
});

describe('exchangeAuthCode', () => {
  it('sends the code and its verifier, with no credentials or referrer', async () => {
    const m = await loadRedirect({});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ did: 'did:ixo:1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const verifier = m.createCodeVerifier();
    await m.exchangeAuthCode('the-code', verifier);

    const [input, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(input);
    expect(`${url.origin}${url.pathname}`).toBe(`${HUB}/api/auth/exchange`);
    expect(url.searchParams.get('code')).toBe('the-code');
    expect(url.searchParams.get('code_verifier')).toBe(verifier);
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('never calls the hub without a valid verifier', async () => {
    const m = await loadRedirect({});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(m.exchangeAuthCode('the-code', '')).rejects.toThrow();
    await expect(m.exchangeAuthCode('the-code', 'short')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not pass hub text or response bodies into its errors', async () => {
    const m = await loadRedirect({});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Call +1 555 for help' }), { status: 400 })),
    );
    await expect(m.exchangeAuthCode('c', m.createCodeVerifier())).rejects.toThrow('Code exchange failed (HTTP 400)');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"sessionMnemonic":"secret words', { status: 200 })),
    );
    const err = await m.exchangeAuthCode('c', m.createCodeVerifier()).catch((e: Error) => e);
    expect((err as Error).message).not.toContain('secret');
  });
});
