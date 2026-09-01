# Playwright + Remotion demo-video pipeline (supamoto pattern)

## Context

We want reproducible tutorial/demo videos of jambo user flows (sign-in, dashboard, claim submission, agent application). We mirror the proven pattern from `ixoworld/supamoto-inventory-web-app` branch `feat/demo-videos-restore`: a **standalone `demo-videos/` package** where Playwright drives the real app in a phone-sized viewport with **all backends mocked**, capturing **one screenshot per step + a manifest.json** (caption, tap coordinates, durations); Remotion then renders each flow as a 1920×1080 MP4 — title card, phone-framed stills, animated tap ripples, captions. Nothing ships with or is imported by the app. Re-run capture + render whenever the UI changes.

Decisions confirmed: mirror supamoto fully (standalone package, screenshots+manifest, mocked backend + seeded fake session), phone frame viewport (390×844 @2x).

## Reference implementation (port + adapt from)

`/Users/pieterpretorius/Documents/github/ixoworld/supamoto-inventory-web-app`, branch `feat/demo-videos-restore`, directory `demo-videos/`:
- `capture/lib/recorder.ts` — `Recorder` class: `step(caption)` / `tap(locator, caption)` (screenshot + bbox center + click), 700ms settle delay, writes `public/captures/<id>/{NN}.png` + `manifest.json`. Port nearly verbatim.
- `capture/lib/mock-api.ts`, `capture/lib/session.ts` — rewrite for jambo (see below).
- `src/manifest.ts` (types + FPS/duration math), `src/flows.ts` (registry), `src/Root.tsx` (one `<Composition>` per flow, `calculateMetadata` fetches manifest via `staticFile`), `src/FlowVideo.tsx`, `src/PhoneFrame.tsx`, `src/TapIndicator.tsx`, `src/theme.ts` — port with jambo branding/theme (pull colors from `styles/` globals; title eyebrow "JAMBO · How to" equivalent).
- `demo-videos/package.json` — pnpm, standalone: `remotion` + `@remotion/cli` 4.0.x, `react`/`react-dom` 19, `playwright` ^1.54, `tsx`, TS 5.x. Scripts: `capture:<flow>`, `studio`, `render:<flow>`, `typecheck`.
- `demo-videos/README.md`, `demo-videos/.gitignore` (ignore `public/captures/`, `out/`, `node_modules/`), `demo-videos/tsconfig.json`, `remotion.config.ts`.

## Jambo-specific adaptations

### Session seeding — use the app's own dev bypass, not forged storage

Jambo's auth storage is complex (redux-persist `jambo-cache`, AES `secure-web-storage` `auth_ixo_*` keys, `auth_version`, 24h consistency checks in `providers/auth.tsx`). Instead of replicating it (supamoto's `session.ts` forges storage), let the app write it itself:
1. Prereq: dev server runs with `NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true` (document in README).
2. Capture script installs route mocks, then `page.goto('/auth/callback?bypass=true')` — `lib/authHub/devBypass.ts` + `pages/auth/callback.tsx` build and persist a full mock session (fixed address/DID/"Dev User"/test mnemonic) with zero prompts.
3. `providers/backgroundSetup.tsx` then attempts a **real Matrix login** with the mock credentials — normally fails and gates `screens/dashboard.tsx` / `collectionDetail.tsx` / `collectionForm.tsx` via `awaitCompletion()`. With Matrix endpoints mocked (below) it succeeds, unblocking all claim screens. This is what makes the mocked approach strictly better here than a real session.

`capture/lib/session.ts` therefore reduces to: bypass navigation helper + the `DEMO` constants (address `ixo1devbypass…`, DID, entity/collection ids used across fixtures).

### mock-api.ts — jambo's backend surface

Intercept with generic catch-alls first, specific fixtures after (Playwright matches routes in reverse registration order):
- **Matrix homeserver** (`NEXT_PUBLIC_MATRIX_HOMESERVER_URL`): `/_matrix/client/v3/login` → fake token; `/sync`, `/capabilities`, `/keys/*`, room-state endpoints → minimal valid responses. Check `utils/matrix.ts` (~line 534 IndexedDBStore init) and `providers/backgroundSetup.tsx` (lines ~102–174) for exactly which calls fire, and mock only those.
- **Matrix bots** (`NEXT_PUBLIC_MATRIX_ROOM_BOT_URL`, `_CLAIM_BOT_URL`, `_STATE_BOT_URL`, `_BID_BOT_URL`): canned success/room/claims fixtures.
- **Jambo worker** (`NEXT_PUBLIC_JAMBO_WORKER_URL`): entity whitelist, collection linkages fixtures (shapes from `store/` slices and worker calls in `hooks/`).
- **Blocksync GraphQL / chain RPC** (via `@ixo/impactxclient-sdk`): entity + claim-collection fixtures shaped from what `screens/dashboard.tsx` and `screens/collectionDetail.tsx` actually read (see `docs/claims.md` for the data flow); catch-all empty results elsewhere. Broadcast/tx endpoints → canned success so "submit" steps complete visually.
- **Feegrant / KYC / Yoma / notifier APIs**: catch-all success stubs.
- Hide noise: `page.addStyleTag` to hide `nextjs-portal`, `.Toastify`, and the `EmailNotificationPrompt`; note `collectionDetail.tsx` polls authz every 5s — mocks make that deterministic.

Fixture shapes get finalized during implementation by reading the store slices/hooks and, where faster, watching the network tab of a real dev session.

### Flows (initial set)

Registered in `src/flows.ts`, one capture script each under `capture/flows/`:
1. `sign-in` — auth screen → dev login → dashboard (proves the pipeline end-to-end; build first).
2. `submit-claim` — dashboard → collection detail → `vct` SurveyJS form → submit → success.
3. `apply-as-agent` — collection detail → "Apply as Agent" (`bco` form) → submitted state.

More flows (profile/credentials, settings) follow the "Adding a new flow" recipe in the README, copied from supamoto's.

## Changes to this repo

- **New directory `demo-videos/`** — everything above. Own pnpm lockfile; own tsconfig; not referenced by the app.
- **Root `.gitignore`** — nothing needed (demo-videos has its own .gitignore; captures/out stay untracked).
- **No app code changes.** Root `package.json`, `tsconfig.json` untouched.

## Verification

1. `cd demo-videos && pnpm install && pnpm exec playwright install chromium`.
2. Terminal A: `yarn dev` at repo root with `NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true` in `.env`.
3. `pnpm capture:sign-in` → confirm `public/captures/sign-in/{01..NN}.png` + `manifest.json`, no debug-failure screenshot.
4. `pnpm studio` → visually check the composition (phone frame, tap ripples, captions, jambo theming).
5. `pnpm render:sign-in` → confirm `out/sign-in.mp4` plays correctly.
6. Repeat capture+render for `submit-claim` and `apply-as-agent` once their fixtures are in place.
7. `pnpm typecheck` inside demo-videos; confirm `git status` at root shows only the new `demo-videos/` directory and the app still runs untouched.
