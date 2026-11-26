import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFakeBrowser, type FakeBrowser } from './testing/fakeBrowser';
import { lastSignInPage, markSwitchAccount, rememberSignInPage, takeSwitchAccount } from './signInFlow';

let browser: FakeBrowser;
beforeEach(() => {
  browser = installFakeBrowser('https://jambo.test/settings');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('switch account marker', () => {
  it('is read once', () => {
    markSwitchAccount('yoma', 1_000);
    expect(takeSwitchAccount(2_000)).toBe('yoma');
    expect(takeSwitchAccount(2_000)).toBeNull();
  });

  it('runs out after 10 minutes, and is cleared anyway', () => {
    markSwitchAccount('yoma', 0);
    expect(takeSwitchAccount(10 * 60 * 1000 + 1)).toBeNull();
    expect(browser.sessionStorage.length).toBe(0);
  });

  it('refuses a malformed provider, written or stored', () => {
    markSwitchAccount('not a provider');
    expect(browser.sessionStorage.length).toBe(0);
    browser.sessionStorage.setItem('ixo_auth_switch_account', JSON.stringify({ provider: 'x&y', ts: Date.now() }));
    expect(takeSwitchAccount()).toBeNull();
    browser.sessionStorage.setItem('ixo_auth_switch_account', '{not json');
    expect(takeSwitchAccount()).toBeNull();
  });
});

describe('last sign-in page', () => {
  it('defaults to /auth and remembers /ixo', () => {
    expect(lastSignInPage()).toBe('/auth');
    rememberSignInPage('/ixo');
    expect(lastSignInPage()).toBe('/ixo');
    rememberSignInPage('/auth');
    expect(lastSignInPage()).toBe('/auth');
  });

  it('never returns a stored value it did not write', () => {
    browser.sessionStorage.setItem('ixo_auth_sign_in_page', 'https://evil.example');
    expect(lastSignInPage()).toBe('/auth');
  });
});
