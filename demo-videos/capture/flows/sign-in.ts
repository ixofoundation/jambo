/**
 * Capture the "sign in" flow: auth screen → authenticate → project dashboard.
 *
 * Prereq: the app dev server is running with the dev bypass enabled
 * (NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true yarn dev at the repo root).
 * Output: public/captures/sign-in/{01..NN}.png + manifest.json
 */
import { chromium } from "playwright";
import type { Page } from "playwright";
import { mockApi } from "../lib/mock-api";
import { Recorder, VIEWPORT } from "../lib/recorder";
import { APP_URL, DEMO, entityUrl, hideDevNoise } from "../lib/session";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("[page]", msg.text());
  });
  await mockApi(page, { serviceAgent: false });
  try {
    await run(page);
  } catch (err) {
    console.error("URL at failure:", page.url());
    await page.screenshot({ path: "debug-failure.png" }).catch(() => {});
    console.error("Debug screenshot: demo-videos/debug-failure.png");
    throw err;
  } finally {
    await browser.close();
  }
}

async function run(page: Page) {
  await page.goto(`${APP_URL}/auth`);
  await hideDevNoise(page);

  // Under NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS the auth screen shows a dev-login
  // button that signs in without the auth-hub round trip.
  const devLogin = page.getByRole("button", { name: "Dev Login (bypass)" });
  await devLogin.waitFor({ timeout: 30_000 });

  const rec = await Recorder.start(page, {
    id: "sign-in",
    title: "Sign in to jambo",
    subtitle: "Authenticate and land on your project dashboard",
  });

  await rec.step("Open jambo — you're greeted by the sign-in screen.");

  const matrixLogin = page
    .waitForResponse((r) => r.url().includes("/_matrix/client/v3/login"), {
      timeout: 60_000,
    })
    .catch(() => null);
  await rec.tap(devLogin, "Tap “Sign in” to authenticate with your ixo account.");
  await page.waitForURL(/\/entities\//, { timeout: 60_000 });
  await matrixLogin;
  await page.waitForTimeout(1_500);

  // Second boot with persisted Matrix tokens → background setup succeeds.
  await page.goto(entityUrl());
  await hideDevNoise(page);
  await page.getByText(DEMO.formTitle).waitFor({ timeout: 30_000 });
  await rec.step(
    "You land on your project dashboard, showing its claim collections.",
    { durationSeconds: 4 },
  );

  await rec.finish();
}

main();
