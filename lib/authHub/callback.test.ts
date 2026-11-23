import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_CALLBACK_CAPTURE_SCRIPT } from './callbackUrl';
import { installFakeBrowser, type FakeBrowser } from './testing/fakeBrowser';

const HUB = 'https://test.auth.example';
const SESSION = { address: 'ixo1abc', did: 'did:ixo:ixo1abc', displayName: null, sessionMnemonic: null };

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_AUTH_HUB_URL', HUB);
  const callback = await import('./callback');
  const pkce = await import('./pkce');
  return { ...callback, ...pkce };
}

let browser: FakeBrowser;
let fetchMock: ReturnType<typeof vi.fn>;

/** Land on the callback the way a browser does: the inline script runs first. */
function landOnCallback(query: string) {
  browser = installFakeBrowser(`https://jambo.test/auth/callback?${query}`);
  fetchMock = vi.fn(async () => {
    browser.events.push('fetch');
    return new Response(JSON.stringify(SESSION), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  new Function(AUTH_CALLBACK_CAPTURE_SCRIPT)();
}

/** A sign-in this browser started, as /auth would have stored it. */
function started(m: Awaited<ReturnType<typeof load>>, returnTo: string | null = null) {
  const state = m.createState();
  const verifier = m.createCodeVerifier();
  m.savePendingSignIn({ state, verifier, returnTo });
  return { state, verifier };
}

beforeEach(() => {
  browser = installFakeBrowser('https://jambo.test/auth');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('completeAuthHubCallback', () => {
  it('happy path: exchanges the code with the stored verifier after the URL is clean', async () => {
    const m = await load();
    const { state, verifier } = started(m, '/entities/did:ixo:1');
    const store = browser.localStorage;
    landOnCallback(`code=good-code&state=${state}`);
    vi.stubGlobal('localStorage', store);

    const result = await m.completeAuthHubCallback();
    expect(result).toEqual({ kind: 'session', session: SESSION, returnTo: '/entities/did:ixo:1' });

    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get('code')).toBe('good-code');
    expect(url.searchParams.get('code_verifier')).toBe(verifier);
    // The address bar was cleaned before the only network call.
    expect(browser.events).toEqual(['replaceState /auth/callback', 'fetch']);
    expect(browser.window.location.href).toBe('https://jambo.test/auth/callback');
    // Single use.
    expect(store.length).toBe(0);
  });

  it('rejects a callback with no stored sign-in (fake code and state), without any network call', async () => {
    const m = await load();
    landOnCallback('code=fake&state=fake');
    await expect(m.completeAuthHubCallback()).rejects.toMatchObject({ reason: 'state_mismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(browser.window.location.href).toBe('https://jambo.test/auth/callback');
  });

  it('rejects a missing state', async () => {
    const m = await load();
    started(m);
    const store = browser.localStorage;
    landOnCallback('code=abc');
    vi.stubGlobal('localStorage', store);
    await expect(m.completeAuthHubCallback()).rejects.toMatchObject({ reason: 'state_mismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong state (a sign-in someone else started)', async () => {
    const m = await load();
    started(m);
    const store = browser.localStorage;
    landOnCallback(`code=abc&state=${m.createState()}`);
    vi.stubGlobal('localStorage', store);
    await expect(m.completeAuthHubCallback()).rejects.toMatchObject({ reason: 'state_mismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a stored sign-in without a verifier', async () => {
    const m = await load();
    const state = m.createState();
    const store = browser.localStorage;
    store.setItem(
      `ixo_auth_hub_pending:${state}`,
      JSON.stringify({ state, verifier: null, returnTo: null, ts: Date.now() }),
    );
    landOnCallback(`code=abc&state=${state}`);
    vi.stubGlobal('localStorage', store);
    await expect(m.completeAuthHubCallback()).rejects.toMatchObject({ reason: 'missing_verifier' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.length).toBe(0);
  });

  it('rejects a replay of a callback that was already used', async () => {
    const m = await load();
    const { state } = started(m);
    const store = browser.localStorage;
    landOnCallback(`code=abc&state=${state}`);
    vi.stubGlobal('localStorage', store);
    await m.completeAuthHubCallback();

    landOnCallback(`code=abc&state=${state}`);
    vi.stubGlobal('localStorage', store);
    await expect(m.completeAuthHubCallback()).rejects.toMatchObject({ reason: 'state_mismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a hub error: fixed reason, pending deleted, nothing exchanged, hub text not in the message', async () => {
    const m = await load();
    const { state } = started(m);
    const store = browser.localStorage;
    landOnCallback(`error=sso_email_required&error_description=${encodeURIComponent('Call +1 555')}&state=${state}`);
    vi.stubGlobal('localStorage', store);
    const err = await m.completeAuthHubCallback().catch((e: Error) => e);
    expect(err).toMatchObject({ reason: 'hub_error' });
    expect((err as Error).message).not.toContain('555');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.length).toBe(0);
    expect(browser.window.location.href).toBe('https://jambo.test/auth/callback');
  });

  it('access_denied is reported as cancelled', async () => {
    const m = await load();
    landOnCallback('error=access_denied');
    await expect(m.completeAuthHubCallback()).rejects.toMatchObject({ reason: 'cancelled' });
  });

  it('an unexpected error code is not echoed', async () => {
    const m = await load();
    landOnCallback(`error=${encodeURIComponent('<b>Call us</b>')}`);
    const err = await m.completeAuthHubCallback().catch((e: Error) => e);
    expect((err as Error).message).toContain('(unknown)');
  });

  it('a failed exchange (code spent, wrong verifier) is exchange_failed with fixed text', async () => {
    const m = await load();
    const { state } = started(m);
    const store = browser.localStorage;
    landOnCallback(`code=abc&state=${state}`);
    vi.stubGlobal('localStorage', store);
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ message: 'PKCE code_verifier missing' }), { status: 400 }),
    );
    const err = await m.completeAuthHubCallback().catch((e: Error) => e);
    expect(err).toMatchObject({ reason: 'exchange_failed', message: 'Code exchange failed' });
  });

  it('nothing to do when opened without parameters', async () => {
    const m = await load();
    landOnCallback('');
    await expect(m.completeAuthHubCallback()).resolves.toEqual({ kind: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
