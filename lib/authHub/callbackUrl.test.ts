import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_CALLBACK_CAPTURE_SCRIPT, captureAuthCallbackFromLocation, takeAuthCallbackParams } from './callbackUrl';
import { installFakeBrowser } from './testing/fakeBrowser';

const runInlineScript = () => new Function(AUTH_CALLBACK_CAPTURE_SCRIPT)();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inline capture script (runs before Next and analytics)', () => {
  it('removes code/state/error parameters from the callback URL and holds them once', () => {
    const browser = installFakeBrowser('https://jambo.test/auth/callback?code=abc&state=st1&keep=1#frag');
    runInlineScript();
    expect(browser.window.location.href).toBe('https://jambo.test/auth/callback?keep=1#frag');
    expect(takeAuthCallbackParams()).toEqual({ code: 'abc', state: 'st1', error: null, errorDescription: null });
    // Handed out once.
    expect(takeAuthCallbackParams()).toEqual({ code: null, state: null, error: null, errorDescription: null });
  });

  it('removes error and error_description too', () => {
    const browser = installFakeBrowser(
      'https://jambo.test/auth/callback?error=access_denied&error_description=Call%20123&state=st1',
    );
    runInlineScript();
    expect(browser.window.location.href).toBe('https://jambo.test/auth/callback');
    expect(takeAuthCallbackParams()).toEqual({
      code: null,
      state: 'st1',
      error: 'access_denied',
      errorDescription: 'Call 123',
    });
  });

  it('leaves every other page alone', () => {
    for (const href of [
      'https://jambo.test/auth?code=abc',
      'https://jambo.test/entities/x?state=1',
      'https://jambo.test/auth/callbackx?code=abc',
    ]) {
      const browser = installFakeBrowser(href);
      runInlineScript();
      expect(browser.window.location.href).toBe(href);
      expect(browser.window.history.replaceState).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it('does nothing on a callback URL without callback parameters (dev bypass)', () => {
    const browser = installFakeBrowser('https://jambo.test/auth/callback?bypass=true');
    runInlineScript();
    expect(browser.window.history.replaceState).not.toHaveBeenCalled();
  });

  it('never throws', () => {
    vi.stubGlobal('window', {});
    expect(runInlineScript).not.toThrow();
  });
});

describe('captureAuthCallbackFromLocation (fallback when the inline script did not run)', () => {
  it('cleans the URL and holds the parameters', () => {
    const browser = installFakeBrowser('https://jambo.test/auth/callback/?code=abc&state=st1');
    expect(captureAuthCallbackFromLocation()).toBe(true);
    expect(browser.window.location.href).toBe('https://jambo.test/auth/callback/');
    expect(takeAuthCallbackParams().code).toBe('abc');
  });

  it('takeAuthCallbackParams captures by itself', () => {
    const browser = installFakeBrowser('https://jambo.test/auth/callback?code=abc&state=st1');
    expect(takeAuthCallbackParams()).toMatchObject({ code: 'abc', state: 'st1' });
    expect(browser.window.location.search).toBe('');
  });
});
