/**
 * Capture the "submit a claim" flow (service agent, vct SurveyJS form).
 *
 * Prereq: the app dev server is running with the dev bypass enabled
 * (NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true yarn dev at the repo root).
 * Output: public/captures/submit-claim/{01..NN}.png + manifest.json
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

  const card = page.getByText(DEMO.formTitle);
  await card.waitFor({ timeout: 30_000 });

  const rec = await Recorder.start(page, {
    id: "submit-claim",
    title: "Submit a claim",
    subtitle: "File a new claim as a service agent",
  });

  await rec.step("Start on your project dashboard.");
  await rec.tap(card, "Open the claim collection.");

  const newClaim = page.getByRole("button", { name: "New Claim" });
  await newClaim.waitFor({ timeout: 30_000 });
  await rec.step("Review your past claims and their evaluation status.");
  await rec.tap(newClaim, "Tap “New Claim” to start a new submission.");

  await page.getByText("Which site did you plant at?").waitFor({ timeout: 30_000 });
  await rec.tap(page.getByText("River Bend"), "Answer the claim questions…");
  await page.locator('input[type="text"]').first().fill("24");
  await page
    .locator("textarea")
    .first()
    .fill("Planted 24 seedlings along the river bank with the school group.");
  await rec.step("…and fill in the details of your work.");

  await rec.tap(
    page.getByRole("button", { name: "Submit", exact: true }),
    "Submit — jambo signs your claim and anchors it on-chain.",
  );

  // The signed credential is uploaded and the claim broadcast on-chain
  // (mocked); the app then returns to the collection screen.
  await page
    .getByText("Signing Transaction")
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  await rec.step("jambo signs the claim with your keys and anchors it on-chain.");
  await page.waitForURL(new RegExp(`claimCollections/${DEMO.collectionId}$`), {
    timeout: 90_000,
  });
  await hideDevNoise(page);
  await page.waitForTimeout(1_000);
  await rec.step("Done — your new claim appears with status “Pending”.", {
    durationSeconds: 4,
  });

  await rec.finish();
}

main();
