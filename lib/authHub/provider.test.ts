import { describe, expect, it } from 'vitest';

import { hubLogoutUrl, isDirectProvider, logoutReturnUrl, normalizeAuthProvider, pinResetUrl } from './provider';

const HUB = 'https://auth.ixo.earth';
const ORIGIN = 'https://jambo.yoma.world';

describe('normalizeAuthProvider / isDirectProvider', () => {
  it('keeps well-formed ids only', () => {
    expect(normalizeAuthProvider('yoma')).toBe('yoma');
    expect(normalizeAuthProvider('workos')).toBe('workos');
    for (const bad of [undefined, null, '', 'Yoma', '1yoma', 'yo-ma', 'yoma&x=1', 42, {}]) {
      expect(normalizeAuthProvider(bad)).toBeNull();
    }
  });

  it('only a non-WorkOS provider is direct', () => {
    expect(isDirectProvider('yoma')).toBe(true);
    expect(isDirectProvider('workos')).toBe(false);
    expect(isDirectProvider(null)).toBe(false);
    expect(isDirectProvider('Not Valid')).toBe(false);
  });
});

describe('pinResetUrl', () => {
  it('names the provider for a Yoma account', () => {
    expect(pinResetUrl(HUB, 'yoma')).toBe(`${HUB}/reset-pin?sso_provider=yoma`);
  });

  it('is the plain page for WorkOS and unknown accounts', () => {
    expect(pinResetUrl(HUB, 'workos')).toBe(`${HUB}/reset-pin`);
    expect(pinResetUrl(HUB, null)).toBe(`${HUB}/reset-pin`);
  });
});

describe('hubLogoutUrl', () => {
  it('returns to the registered /auth/callback, with the provider for a Yoma account', () => {
    expect(logoutReturnUrl(ORIGIN)).toBe(`${ORIGIN}/auth/callback`);
    const url = new URL(hubLogoutUrl(HUB, ORIGIN, 'yoma'));
    expect(`${url.origin}${url.pathname}`).toBe(`${HUB}/api/auth/logout`);
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/callback`);
    expect(url.searchParams.get('sso_provider')).toBe('yoma');
    expect(url.searchParams.has('organization_id')).toBe(false);
  });

  it('has no sso_provider for a WorkOS account', () => {
    expect(new URL(hubLogoutUrl(HUB, ORIGIN, 'workos')).searchParams.has('sso_provider')).toBe(false);
  });
});
