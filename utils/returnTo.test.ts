import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFakeBrowser, type FakeBrowser } from 'lib/authHub/testing/fakeBrowser';

import { peekReturnTo, returnablePath, sameOriginPath, saveReturnTo, takeReturnTo } from './returnTo';

const ORIGIN = 'https://jambo.test';

describe('sameOriginPath', () => {
  it('accepts paths on this site and returns the rebuilt path', () => {
    expect(sameOriginPath('/entities/did:ixo:1?tab=2#x', ORIGIN)).toBe('/entities/did:ixo:1?tab=2#x');
    expect(sameOriginPath('/cleanup/home', ORIGIN)).toBe('/cleanup/home');
    expect(sameOriginPath('/a/../b', ORIGIN)).toBe('/b');
  });

  it.each([
    ['protocol-relative', '//evil.example/x'],
    ['absolute URL', 'https://evil.example/'],
    ['scheme', 'javascript:alert(1)'],
    ['relative', 'entities/1'],
    ['backslash', '/\\evil.example'],
    ['tab', '/\t/evil.example'],
    ['newline', '/\n/evil.example'],
    ['carriage return', '/\r/evil.example'],
    ['space', '/ /evil.example'],
    ['NUL', '/\u0000/evil.example'],
    ['DEL', '/\u007f/evil.example'],
    ['dot-segment to //', '/.//evil.example'],
    ['empty', ''],
  ])('rejects %s', (_name, path) => {
    expect(sameOriginPath(path, ORIGIN)).toBeNull();
  });

  it('rejects non-strings and a missing origin', () => {
    expect(sameOriginPath(undefined, ORIGIN)).toBeNull();
    expect(sameOriginPath(42, ORIGIN)).toBeNull();
    expect(sameOriginPath('/entities/1', undefined)).toBeNull();
  });
});

describe('returnablePath', () => {
  it('keeps real deep links', () => {
    expect(returnablePath('/entities/did:ixo:1', ORIGIN)).toBe('/entities/did:ixo:1');
  });

  it.each(['/', '/auth', '/auth/callback', '/auth?returnTo=/x', '/entities/[entityId]'])('rejects %s', (path) => {
    expect(returnablePath(path, ORIGIN)).toBeNull();
  });
});

describe('save / peek / take', () => {
  let browser: FakeBrowser;
  beforeEach(() => {
    browser = installFakeBrowser(`${ORIGIN}/entities/1`);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves a deep link, peeks it, then takes it once', () => {
    saveReturnTo('/entities/1?tab=2');
    expect(peekReturnTo()).toBe('/entities/1?tab=2');
    expect(takeReturnTo()).toBe('/entities/1?tab=2');
    expect(takeReturnTo()).toBeNull();
  });

  it.each(['//evil.example', '/\t/evil.example', '/\\evil.example', '/', '/auth'])('never saves %s', (path) => {
    saveReturnTo(path);
    expect(browser.sessionStorage.length).toBe(0);
  });

  it('re-validates what storage holds', () => {
    browser.sessionStorage.setItem('ixo_return_to', JSON.stringify({ path: '/\\evil.example', ts: Date.now() }));
    expect(takeReturnTo()).toBeNull();
  });
});
