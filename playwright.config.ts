import { defineConfig, devices } from '@playwright/test';

/**
 * Two projects, because they answer different questions:
 *
 * - `smoke` builds and serves the app locally and checks everything that does not
 *   need a signed-in wallet: every action route renders, metadata matches the
 *   config, the wallet picker appears, and no page logs a console error. This runs
 *   on every PR and needs no secrets.
 * - `deployed` runs the same specs against an already-deployed URL
 *   (`PLAYWRIGHT_BASE_URL`), so a preview deploy can be verified rather than merely
 *   assumed to have worked.
 *
 * Full action flows — capture, review, sign — need an authenticated wallet and land
 * here once the AuthHub adapter exists.
 */

/**
 * Read an env var, treating empty and whitespace-only as unset.
 *
 * `??` is not enough here. GitHub Actions materialises an unprovided
 * `workflow_dispatch` input as an empty string rather than leaving it unset, so
 * `process.env.PLAYWRIGHT_BASE_URL ?? fallback` yields '' on a pull_request run.
 * That made every `page.goto('/about')` fail with "Cannot navigate to invalid URL"
 * in CI while passing locally, where the variable was genuinely absent.
 */
const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const PORT = Number(env('PLAYWRIGHT_PORT') ?? 3210);
const deployedBaseUrl = env('PLAYWRIGHT_BASE_URL');
const baseURL = deployedBaseUrl ?? `http://127.0.0.1:${PORT}`;
const isDeployed = !!deployedBaseUrl;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: isDeployed ? 'deployed' : 'smoke',
      use: {
        ...devices['Desktop Chrome'],
        // Some environments (CI images, the Claude Code sandbox) ship a Chromium
        // whose build number does not match what this Playwright version would
        // download. Point at it explicitly rather than fetching a second copy.
        launchOptions: env('CHROMIUM_PATH') ? { executablePath: env('CHROMIUM_PATH') } : {},
      },
    },
  ],
  // Against a deployed URL there is nothing to start.
  webServer: isDeployed
    ? undefined
    : {
        command: `yarn build && yarn start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: {
          NEXT_PUBLIC_CHAIN_NAMES: 'impacthub',
          NEXT_PUBLIC_DEFAULT_CHAIN_NAME: 'impacthub',
          NEXT_PUBLIC_ENABLE_DEVELOPER_MODE: '1',
          NEXT_PUBLIC_DEFAULT_CHAIN_NETWORK: 'testnet',
          NEXT_PUBLIC_USE_LOCAL_BLOCKCHAIN_PORT: '0',
        },
      },
});
