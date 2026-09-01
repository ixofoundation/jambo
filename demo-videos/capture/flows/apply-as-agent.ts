/**
 * Capture the "apply as agent" flow (bco contributor application form).
 *
 * Prereq: the app dev server is running with the dev bypass enabled
 * (NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true yarn dev at the repo root).
 * Output: public/captures/apply-as-agent/{01..NN}.png + manifest.json
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
  await signInViaBypass(page);
  await page.goto(entityUrl());
  await hideDevNoise(page);

  const card = page.getByText(DEMO.formTitle);
  await card.waitFor({ timeout: 30_000 });

  const rec = await Recorder.start(page, {
    id: "apply-as-agent",
    title: "Apply as an agent",
    subtitle: "Become a contributor on a claim collection",
  });

  await rec.step("From your dashboard, open the collection you want to work on.");
  await rec.tap(card, "Open the claim collection.");

  const apply = page.getByRole("button", { name: "Apply as Contributor" });
  await apply.waitFor({ timeout: 30_000 });
  await rec.step("You're not a contributor yet — apply to become one.");
  await rec.tap(apply, "Tap “Apply as Contributor”.");

  await page.getByText("Your full name").waitFor({ timeout: 30_000 });
  await page.locator('input[type="text"]').first().fill("Amara Banda");
  await page
    .locator("textarea")
    .first()
    .fill(
      "I live nearby and have planted with this project before — I want to log my own claims.",
    );
  await rec.step("Fill in the short application form.");

  await rec.tap(
    page.getByRole("button", { name: "Submit", exact: true }),
    "Submit your application to the project.",
  );

  await page.waitForURL(new RegExp(`claimCollections/${DEMO.collectionId}$`), {
    timeout: 60_000,
  });
  await hideDevNoise(page);
  await page
    .getByText("Service agent application pending")
    .waitFor({ timeout: 30_000 });
  await rec.step("Your application is submitted and pending review.", {
    durationSeconds: 4,
  });

  await rec.finish();
}

main();
