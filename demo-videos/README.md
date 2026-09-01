# jambo demo videos

Generates polished demo videos of app flows (sign in, submit a claim,
apply as agent, …) by driving the real app with Playwright and rendering
the captures with [Remotion](https://remotion.dev).

Standalone package — nothing here ships with, or is imported by, the app.

## How it works

1. **Capture** (`capture/flows/*.ts`): a Playwright script launches the real
   Next.js app in a phone-sized viewport, intercepts all backends with canned
   fixtures (Matrix homeserver + bots, jambo worker, blocksync/chain, feegrant
   — no real backend or auth hub), signs in via the app's dev-bypass route,
   and walks through one flow. Each step records a screenshot, a caption, and
   the tap position. Output: `public/captures/<flow>/` with numbered PNGs +
   `manifest.json`.
2. **Render** (`src/`): a Remotion composition per flow (registered in
   `src/flows.ts`) reads that manifest and renders a 1920×1080 video — title
   card, phone-framed screenshots, animated tap ripples, step captions, and a
   progress indicator.

## Usage

```bash
cd demo-videos
pnpm install
pnpm exec playwright install chromium

# 1. Start the app (from the repo root) in another terminal, with the
#    dev bypass enabled (in .env: NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true):
#    yarn dev
# 2. Capture a flow:
pnpm capture:sign-in          # writes public/captures/sign-in/
# 3. Preview / render:
pnpm studio                   # interactive preview
pnpm render:sign-in           # writes out/sign-in.mp4
```

`APP_URL` overrides the app origin (default `http://localhost:3000`).

## Adding a new flow

1. Copy `capture/flows/sign-in.ts`, adjust the mocked responses
   (`capture/lib/mock-api.ts` fixtures) and the scripted steps.
2. Add a `capture:<flow>` script to `package.json`.
3. Register the flow id in `src/flows.ts`.
4. Capture, then render: `pnpm render <flow> out/<flow>.mp4`.

When the app UI changes, re-run the capture script and re-render — no manual
screen recording.
