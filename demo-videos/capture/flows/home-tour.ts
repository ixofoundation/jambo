/**
 * Capture the "navigate the home screen" tour: dashboard → collection and
 * back → project list and back → profile → home via the logo.
 *
 * Prereq: the app dev server is running with the dev bypass enabled
 * (NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true yarn dev at the repo root).
 * Output: public/captures/home-tour/{01..NN}.png + manifest.json
 */
import { chromium } from "playwright";
import type { Page } from "playwright";
import { mockApi } from "../lib/mock-api";
import { Recorder, VIEWPORT } from "../lib/recorder";
import { DEMO, entityUrl, hideDevNoise, signInViaBypass } from "../lib/session";

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
  await mockApi(page, { serviceAgent: true });
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
  await signInViaBypass(page);
  await page.goto(entityUrl());
  await hideDevNoise(page);

  const card = page.getByRole("button", { name: DEMO.formTitle });
  await card.waitFor({ timeout: 30_000 });

  const rec = await Recorder.start(page, {
    id: "home-tour",
    title: "Navigate your home screen",
    subtitle: "Find your way around after signing in",
  });

  await rec.step(
    "After signing in you land on your home screen: your project and its claim collections.",
    { durationSeconds: 4 },
  );

  // Collection → back
  await rec.tap(card, "Tap a collection card to open it.");
  const backToCollections = page.getByText("Claim Collections");
  await backToCollections.waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "New Claim" }).waitFor({ timeout: 30_000 });
  await rec.tap(backToCollections, "Tap “Claim Collections” to go back home.");
  await card.waitFor({ timeout: 30_000 });

  // Project list → back
  await rec.tap(
    page.getByRole("button", { name: "Back to projects" }),
    "The arrow next to the project name shows all your projects.",
  );
  const project = page.getByRole("button", { name: DEMO.projectName });
  await project.waitFor({ timeout: 30_000 });
  await rec.tap(project, "Pick a project to open its home screen.");
  await card.waitFor({ timeout: 30_000 });

  // Profile → home via logo
  await rec.tap(
    page.getByRole("button", { name: "Profile" }),
    "The profile icon opens your profile, credentials and wallet.",
  );
  await page.waitForURL(/\/profile/, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await rec.tap(
    page.getByRole("img", { name: "Jambo" }).first(),
    "Tap the yoma logo any time to return home.",
  );
  await card.waitFor({ timeout: 30_000 });
  await rec.step("You're back on your home screen.", { durationSeconds: 3 });

  await rec.finish();
}

main();
