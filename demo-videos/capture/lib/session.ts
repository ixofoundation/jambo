import type { Page } from "playwright";

export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Demo identity: the app's own dev-bypass session (lib/authHub/devBypass.ts)
 * plus the fixture entity/collection the mocked backends serve. All network
 * calls are mocked (see mock-api.ts), so none of these values ever reach a
 * real backend.
 */
export const DEMO = {
  // Values written by the app's dev bypass — must match lib/authHub/devBypass.ts.
  address: "ixo1devbypassaddress000000000000000000000",
  did: "did:ixo:devbypass000000000000000000000",
  displayName: "Dev User",
  matrixUserId: "@ixo1devbypassaddress:devmx.ixo.earth",
  // Address derived from the bypass session mnemonic (abandon…about, ixo prefix);
  // the mocked chain returns a BaseAccount for it.
  sessionAddress: "ixo19rl4cm2hmr8afy4kldpxz3fka4jguq0ar4n0mx",
  // Fixture world served by the mocks.
  entityDid: "did:ixo:entity:demoproject0001",
  protocolDid: "did:ixo:entity:demoprotocol0001",
  adminAddress: "ixo1demoadmin00000000000000000000000000000",
  // Must NOT collide with NEXT_PUBLIC_APPROVE_PAYMENT_COLLECTION in .env,
  // which routes claims into the KYC-gated approve-payment flow.
  collectionId: "1042",
  projectName: "Demo Impact Project",
  formTitle: "Tree Planting Claim",
} as const;

export const entityUrl = () => `${APP_URL}/entities/${DEMO.entityDid}`;
export const collectionUrl = () =>
  `${entityUrl()}/claimCollections/${DEMO.collectionId}`;

/** Hide dev-server noise + toasts so captures stay clean. Re-run after every
 * hard navigation (client-side navigation keeps the injected style alive). */
export async function hideDevNoise(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "nextjs-portal, #__next-build-watcher, .Toastify { display: none !important; }",
  });
}

/**
 * Authenticate via the app's dev bypass and leave the browser with a fully
 * persisted session INCLUDING Matrix tokens:
 *
 * 1st boot — `/auth/callback?bypass=true` logs in with zero prompts and the
 * background setup runs `mxLogin` against the mocked homeserver, persisting
 * the Matrix access token. Its follow-up encryption bootstrap cannot succeed
 * against mocks, which is fine: the caller must hard-navigate afterwards, and
 * the 2nd boot takes the token-reattach branch (providers/backgroundSetup.tsx)
 * that reaches 'success' without any crypto bootstrap.
 *
 * Requires the dev server to run with NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true.
 */
export async function signInViaBypass(page: Page): Promise<void> {
  const matrixLogin = page
    .waitForResponse((r) => r.url().includes("/_matrix/client/v3/login"), {
      timeout: 60_000,
    })
    .catch(() => null);
  // Click through the auth screen's dev-login button: a client-side
  // navigation to /auth/callback?bypass=true. (A hard goto to the callback
  // URL fails — Next 12 hydrates with an empty router.query first and the
  // callback bails back to /auth before it sees the bypass param.)
  await page.goto(`${APP_URL}/auth`);
  const devLogin = page.getByRole("button", { name: "Dev Login (bypass)" });
  await devLogin.waitFor({ timeout: 30_000 });
  await devLogin.click();
  await page.waitForURL(/\/entities\//, { timeout: 60_000 });
  await matrixLogin;
  // Small settle so the token write + redux persist flush complete.
  await page.waitForTimeout(1_500);
}
