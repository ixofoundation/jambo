# demo-videos — instructions for Claude Code

This package produces demo/tutorial MP4s of app flows. Non-technical
coworkers will ask for videos in plain language (see GUIDE.md). Your job is
to deliver a finished MP4, not scripts — they don't want to run anything.

## Workflow when someone asks for a video

1. **Setup (if needed):** `cd demo-videos && pnpm install && pnpm exec playwright install chromium`.
2. **Dev server:** from the repo root run
   `NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS=true yarn dev` in the background and wait
   until `http://localhost:3000/auth` returns 200. Don't edit `.env`.
3. **Existing flow?** If the request matches `capture/flows/<id>.ts`
   (`sign-in`, `submit-claim`, `apply-as-agent`, `home-tour`), just run
   `pnpm capture:<id>` then `pnpm render:<id>`.
4. **New flow:** copy the closest flow in `capture/flows/`, script the
   steps with `rec.step(caption)` / `rec.tap(locator, caption)`, add
   `capture:<id>` + `render:<id>` scripts to `package.json`, and register the
   id in `src/flows.ts`. Extend fixtures in `capture/lib/mock-api.ts` if the
   flow needs data the mocks don't serve yet.
5. **Verify:** look at the captured PNGs in `public/captures/<id>/` (Read
   them) before rendering — check the final frame shows the intended end
   state, not a loading overlay.
6. **Deliver:** render, then send `out/<id>.mp4` to the user with
   SendUserFile. Stop the dev server you started.
7. **Cleanup:** delete `debug-failure.png` if a run failed.

## Capture rules (learned the hard way)

- Sign in via `signInViaBypass()` from `capture/lib/session.ts` — it clicks
  the auth page's dev-login button, then the flow must hard-`goto` its
  first screen so Matrix reattaches with persisted tokens.
- All backends are mocked; fulfilled cross-origin responses need CORS
  headers (the `json()` helper does this). Never let real requests out.
- Fixture collection id must not equal `NEXT_PUBLIC_APPROVE_PAYMENT_COLLECTION`.
- Prefer role-based locators (`getByRole('button', { name })`). Plain
  `getByText` can collide with Next's route announcer after navigation.
- SurveyJS submit button is labelled plain "Submit"; the header logo is an
  `<img alt="Jambo">`, not a link.
- The app has no swipe gestures — navigation is taps only. Tell the user
  if they ask for something the app doesn't do.
- When adding fixture ids that end up inside protobuf blobs (grants,
  account), regenerate the blobs with the app's `@ixo/impactxclient-sdk`.
