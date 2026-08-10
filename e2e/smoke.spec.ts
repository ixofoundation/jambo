import { expect, test } from '@playwright/test';

import config from '../constants/config.json';

/**
 * Everything that can be asserted without a signed-in wallet.
 *
 * Deliberately data-driven off `constants/config.json`: a fork that changes its
 * actions gets those actions checked, with no test to update. This is the suite
 * that verifies a deploy actually works rather than merely having uploaded.
 */

/**
 * Console errors that say something about the environment rather than the app.
 *
 * The point of the console assertion is to catch *application* faults — React
 * errors, uncaught exceptions, undefined property access. Network-layer failures
 * are not that: this app resolves chain info from third-party infrastructure
 * (registry.ping.pub via @ixo/cosmos-chain-resolver, then a live RPC), so whether
 * those calls succeed depends entirely on where the tests run.
 *
 * Concretely, the same page produces different console output on a GitHub runner
 * (reaches registry.ping.pub, gets a CORS rejection because it sends no
 * Access-Control-Allow-Origin) than behind a proxy (the request fails earlier as a
 * resource load error). Asserting zero console errors would make this suite fail
 * based on the network it happens to be on.
 *
 * Keep these patterns narrow. Anything matching here is invisible to the suite.
 */
const IGNORED_CONSOLE = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /blocked by CORS policy/i,
  /Access to (XMLHttpRequest|fetch|resource) at/i,
  /Download the React DevTools/i,
];

const collectConsoleErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  return errors;
};

test.describe('home', () => {
  test('renders the configured site name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(config.siteName);
  });

  test('has no placeholder config strings left in the document', async ({ page }) => {
    await page.goto('/');
    // The shipped config used to contain literal "config.siteName" placeholders
    // which rendered verbatim in the header and meta tags.
    await expect(page.locator('body')).not.toContainText(/config\.(siteName|siteUrl|about)/);
  });

  test('exposes the configured description as a meta tag', async ({ page }) => {
    await page.goto('/');
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', config.siteDescriptionMeta);
  });
});

test.describe('actions', () => {
  // One test per configured action, named after it, so a failure says which broke.
  for (const action of config.actions) {
    test(`/${action.id} (${action.name}) renders`, async ({ page }) => {
      const errors = collectConsoleErrors(page);

      const response = await page.goto(`/${action.id}`);
      expect(response?.status(), `GET /${action.id}`).toBeLessThan(400);

      // Signed out, every action shows the connect-wallet prompt rather than the
      // first step. That is the correct behaviour and is what we assert here.
      await expect(page.locator('body')).toContainText(/connect your wallet/i);

      expect(errors, `console errors on /${action.id}`).toEqual([]);
    });
  }

  test('an unknown action id is a 404, not a blank page', async ({ page }) => {
    // getStaticPaths uses fallback: false, so unlisted ids must 404.
    const response = await page.goto('/definitely-not-an-action');
    expect(response?.status()).toBe(404);
  });
});

test.describe('account', () => {
  test('offers the wallet picker when signed out', async ({ page }) => {
    await page.goto('/account');
    await expect(page.locator('body')).toContainText(/choose your wallet|no wallet detected/i);
  });
});

test.describe('static pages', () => {
  test('about renders the configured copy', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('main')).not.toBeEmpty();
  });

  test('terms renders', async ({ page }) => {
    const response = await page.goto('/termsAndConditions');
    expect(response?.status()).toBeLessThan(400);
  });
});
