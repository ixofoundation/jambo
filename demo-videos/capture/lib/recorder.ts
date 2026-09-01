import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "playwright";
import type { FlowManifest, FlowStep } from "../../src/manifest";

export const VIEWPORT = { width: 390, height: 844 };

/** Delay before each screenshot so sheet/transition animations finish. */
const SETTLE_MS = 700;

const CAPTURES_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "..",
  "public",
  "captures",
);

export type StepOptions = { durationSeconds?: number };

/**
 * Collects screenshots + tap coordinates into a FlowManifest that the
 * Remotion composition consumes. One instance per flow capture run.
 */
export class Recorder {
  private steps: FlowStep[] = [];
  private dir: string;

  private constructor(
    private page: Page,
    private meta: { id: string; title: string; subtitle?: string },
  ) {
    this.dir = path.join(CAPTURES_DIR, meta.id);
  }

  static async start(
    page: Page,
    meta: { id: string; title: string; subtitle?: string },
  ): Promise<Recorder> {
    const rec = new Recorder(page, meta);
    await mkdir(rec.dir, { recursive: true });
    return rec;
  }

  /** Screenshot the current screen with a caption. */
  async step(caption: string, opts: StepOptions = {}): Promise<void> {
    // Fixed settle delay: the app polls in the background (authz every 5s),
    // so networkidle would stall; this just lets transitions finish.
    await this.page.waitForTimeout(SETTLE_MS);
    const file = `${String(this.steps.length + 1).padStart(2, "0")}.png`;
    await this.page.screenshot({ path: path.join(this.dir, file) });
    this.steps.push({ screenshot: file, caption, ...opts });
  }

  /**
   * Screenshot with a tap indicator at the target element's center,
   * then actually click it.
   */
  async tap(
    target: Locator,
    caption: string,
    opts: StepOptions = {},
  ): Promise<void> {
    await target.waitFor({ state: "visible" });
    await target.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(SETTLE_MS);
    const box = await target.boundingBox();
    if (!box) throw new Error(`No bounding box for tap step: ${caption}`);
    const file = `${String(this.steps.length + 1).padStart(2, "0")}.png`;
    await this.page.screenshot({ path: path.join(this.dir, file) });
    this.steps.push({
      screenshot: file,
      caption,
      tap: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      ...opts,
    });
    await target.click();
  }

  /** Write manifest.json — call once at the end of the flow. */
  async finish(): Promise<void> {
    const manifest: FlowManifest = {
      id: this.meta.id,
      title: this.meta.title,
      subtitle: this.meta.subtitle,
      viewport: VIEWPORT,
      steps: this.steps,
    };
    await writeFile(
      path.join(this.dir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    console.log(
      `✓ Captured ${this.steps.length} steps for "${this.meta.id}" → ${this.dir}`,
    );
  }
}
