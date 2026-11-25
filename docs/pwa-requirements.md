# PWA requirements (Phases 1–3)

A spec another team can build from in a different repo. It says **what** the app must do and **why**, plus the traps found while building it in JAMBO. JAMBO's code is the reference build (file list at the end), but nothing here needs that code.

- Phase 1: the app can be installed and opens with no signal.
- Phase 2: the app shows saved data when the network fails, and uses little data.
- Phase 3: a user can fill in and submit a claim with no signal, and it sends itself later.

Push notifications (Phase 4) are not covered. They need a server and decisions about who owns it.

## 0. Before you start

### Who this is for

Youth on cheap Android phones (1–2GB of memory), paying for data by the megabyte, with patchy signal. Some use iPhones. Phones are often shared. Every rule below follows from that: small downloads, no lost work, and nothing left behind for the next person.

### Answer these about the target app first

The design depends on these answers. Write them down in the target repo before building.

| Question | Why it matters | JAMBO's answer |
| --- | --- | --- |
| Does any page render user data on the server (`getServerSideProps`, server components with cookies)? | If yes, cached HTML would show one user's data to another. Those pages must not be cached. | No. Every page is static HTML; user data loads in the browser. |
| Which paths must never be touched by our worker? | Sign-in callbacks, API routes, analytics proxies, other apps mounted on the same domain. | `/api/*`, `/auth/*`, `/ingest/*` (analytics), `/cleanup/*` (another app with its own worker). |
| Where do the signing keys and login tokens live? | If they are in `localStorage` or memory, a service worker can't read them, so sending must happen in the page. | Encrypted in `localStorage`. Matrix login in page memory. |
| What is the submit flow, step by step, and which steps need the network? | Decides what can happen offline and what must wait. | See 3.1. |
| Are files uploaded when picked or on submit? | Picked-when-offline files must be held on the phone. | When picked. |
| How long does a sign-in session last? | Queued work must survive the session ending. | 24 hours. |
| Is there already a client-side store that persists (redux-persist, React Query persist)? | Phase 2 mostly reuses it instead of caching API calls in the worker. | redux-persist into `localStorage`. |
| Which hosts serve images, and do they send `Access-Control-Allow-Origin`? | Without CORS, a cached image costs ~7MB of storage quota in Chrome (see Traps). | IPFS gateways and cellnodes all send `ACAO: *`. |
| Which framework version? | Off-the-shelf PWA plugins need recent versions. | Next.js 12.1.6, too old for Serwist, so the worker is hand-written. |

## Phase 1: Installable

### 1.1 Manifest

- A `manifest.webmanifest` served with `Content-Type: application/manifest+json` and `Cache-Control: no-cache`.
- Fields: `id`, `name`, `short_name` (12 characters or less, so it fits under the home-screen icon), `start_url` with a marker such as `/?source=pwa`, `scope: "/"`, `display: "standalone"`, `theme_color`, `background_color` (matching the app's background, so the launch screen doesn't flash white).
- Icons: 192px and 512px with `purpose: "any"`, and 192px and 512px with `purpose: "maskable"` (the logo inside the middle 80%, so Android's round crop doesn't cut it). A 180px `apple-touch-icon` for iPhone. Make them from a 1024px square source with a script, so they can be remade.
- Shortcuts (long-press on the icon) to the 2–4 most used screens, each with `?source=pwa-shortcut`.
- In the HTML head: the manifest link, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`.

**Done when:** Chrome DevTools → Application → Manifest shows no errors and offers install. The icon looks right on Android (round crop) and on iPhone.

### 1.2 Service worker

One hand-written worker at the site root (`/sw.js`), served with `Cache-Control: no-cache` so phones always check for a new one.

- **Versioned at build time.** A build step copies the source to `public/sw.js` and stamps in a version (the commit SHA, or a timestamp locally). The generated file is gitignored. A changed file is how phones notice a release.
- **Not in dev mode** by default. It fights with hot reload. Allow it with an opt-in variable.

Caching rules:

| Request | Rule | Cap |
| --- | --- | --- |
| Hashed build files (`/_next/static/*` or your bundler's equivalent) | Cache first. Names are hashed, so each file downloads once, across releases. | 250 entries |
| Page navigations | Network first. If the network fails or takes over **6 seconds**, the saved copy of that page; with no copy, the offline page. One copy per path; ignore the query string. | 40 pages |
| Own images, icons, favicon, web fonts | Saved copy at once, refresh in the background. | 80 |
| Everything on the bypass list (0) | Not touched at all: no `respondWith`. | — |
| Every other request and origin (APIs, chain, chat, payments, KYC) | Not touched. | — |

- Caps are enforced by deleting the oldest entries after each write.
- At install, save the offline page, one icon and the manifest. Also save the 3–4 main pages, so the installed app opens offline even on pages the user never visited. A failure here must not fail the install.
- At activate, delete only your own old caches (match by your prefix). Never delete other apps' caches.
- When a handler can't find something in its own cache, fall back to `caches.match` across all caches. (The offline page's icon broke without this.)

### 1.3 Offline page

A self-contained `offline.html`: inline styles, no scripts or fonts from the network, the app icon, a plain message, a "Try again" button, and a reload when the `online` event fires.

**Done when:** with the server stopped, a page never visited shows the offline page; a page visited before shows its saved copy.

### 1.4 Updates

- A new worker installs in the background and **waits**. It never takes over by itself.
- The page shows a small "A new version is ready · Update" pill. Tapping it tells the worker to skip waiting; the page reloads once on `controllerchange`.
- The pill never shows on the sign-in pages or on the claim form, so nothing can reload a half-finished form or sign-in step.
- Installed apps stay open for days: also check for an update when the app comes back to the front, at most every 30 minutes.

### 1.5 Kill switch

A release with a bad worker must be fixable with one environment variable and a redeploy, without a code change.

- With the variable set, the build ships a different `sw.js` that deletes your caches, unregisters itself and reloads open pages.
- The page, in the same build, must stop registering a worker and remove any it finds. Without this, each reload registers the kill switch again and loops.

### 1.6 Install offer

- **Android and desktop Chrome:** catch `beforeinstallprompt`, prevent the browser's banner, keep the event. Offer install **after a good moment** (the first claim submitted), never on first visit. A bottom sheet with "Install" (calls `prompt()`) and "Not now".
- **iPhone and iPad:** there is no install API. The same sheet shows two steps: "Tap Share" and "Add to Home Screen".
- "Not now" pauses the automatic offer for 14 days.
- A permanent "Install the app" row in Profile or Settings whenever the phone can install and hasn't.
- Nothing shows when already running installed (`display-mode: standalone`, or `navigator.standalone` on iPhone).
- The sheet never shows on the sign-in pages or the claim form.

### 1.7 Analytics

- Every event carries `display_mode`: `standalone` or `browser`.
- Events: install sheet shown (with the platform and what triggered it), the prompt's result (accepted or dismissed), sheet dismissed, `appinstalled`, update accepted. Phase 3 adds claim queued and file held.

## Phase 2: Offline data, cheap on data

### 2.1 Use saved data when the network fails

The rule: **if a refresh fails, show the last good copy instead of nothing.** Do this in the app's data layer, not by caching API responses in the worker. The data layer knows which user it belongs to; the worker doesn't.

Required:

- **Claim forms open offline.** Form templates and the entities they come from must be saved, and returned when a refresh fails. (In JAMBO the entity fetch treated a 5-minute-old copy as stale and returned nothing when the refresh failed. That one change made forms open offline.)
- **Permission to claim shows offline.** If the "can this user submit here?" check fails for network reasons, use the last successful answer, saved per account and collection. The real check still happens when the claim is sent.
- **Balance shows offline.** Save the last good balance per account and show it with "As of 10:42" until a live read arrives. Only the display uses the saved value. Anything that moves money uses live numbers only.
- **Lists show instantly** from saved data, then refresh in the background.

### 2.2 Remote images

- Opportunity and claim images from other hosts: saved copy at once, refresh in the background. Cap 150.
- Fetch in **CORS mode**. If a host refuses CORS, load it normally and don't save it.

### 2.3 Screen code

After sign-in, wait 8 seconds, then, when the browser is idle, prefetch the code for the main screens (home, tasks, wallet, profile, collection page, claim form), so they open offline later.

### 2.4 Save-Data

When `navigator.connection.saveData` is on, or `effectiveType` is `2g` or `slow-2g`, skip the warm-up in 2.3 and any other prefetching.

### 2.5 Never cache

Balances (except the display copy in 2.1), payments, KYC, sign-in, signing, chat or other personal data, analytics.

### 2.6 Logout

Logout and session expiry delete: the saved balance, every saved permission, and the remote-image cache. App code and page caches stay: they hold no user data, and keeping them saves the next user's data.

## Phase 3: Claims with no signal

### 3.1 Map the submit flow first

Before building, list every step of the existing submit, and whether each needs the network. JAMBO's:

| Step | Network? |
| --- | --- |
| Load the signing key | No (encrypted in `localStorage`) |
| Check the key is on the user's DID document | Yes |
| Register the key if missing | Yes, chain transaction |
| Sign the claim as a Verifiable Credential | **No** (local resolver, bundled JSON-LD contexts) |
| Save the signed claim to storage, get a content ID (CID) | Yes |
| Look up the collection admin | Yes |
| Sign and broadcast the claim transaction | Yes. Needs the account's current sequence number from the chain |

What follows from this:

- The chain transaction **can't be signed ahead of time**. It needs the account's sequence number, and any other transaction sent in between makes it invalid.
- The claim ID is the hash of the signed credential. **Sign once** and keep it: signing again makes a different claim.
- Files referenced in the credential must be uploaded **before** signing. So sign at send time, not at submit time. The credential's issue date is then the send date. Get product sign-off on that.

### 3.2 Files picked offline

- When there's no connection, or the upload fails **because of the network** (not because the server refused it), keep the processed (compressed) file in IndexedDB and put a placeholder in the answer, such as `{"heldFile": "<id>", "name": "...", "type": "..."}`.
- The form previews held files from the phone.
- A refusal from the server (too large, wrong type, 4xx) still fails as before.
- Don't hold files over 100MB.
- Telling a network failure from a refusal: `TypeError: Failed to fetch` (Chrome), `NetworkError` (Firefox), `Load failed` (Safari), or `navigator.onLine === false`. Match `load failed` on a word boundary: a plain match also hits "Upload failed: 413".

### 3.3 Offline submit

- Only for the plain claim form. Other forms (sub-claims, payment approvals, applications) still need a connection, and are blocked with a clear message if they hold a file that hasn't uploaded.
- When offline, or when the form holds files: save `{account, DID, entity, collection, title, answers, created time}` to an IndexedDB queue instead of sending. Clear the draft, go back to the collection, and show "Saved. It will send when you're back online."
- Change the existing submit function as little as possible: add a branch before it, not inside it.
- Ask the browser to keep storage (`navigator.storage.persist()`) the first time something is queued, so a phone low on space doesn't delete it.

### 3.4 Sending

Runs **in the page**, because the keys and login live there. So claims send while the app is open, not when it's closed. No Background Sync. A worker can't sign.

When to try:

- on sign-in;
- on the `online` event;
- when the app comes back to the front;
- right after a claim is queued while online;
- every 2 minutes while any are waiting;
- on "Send now".

Only one run at a time.

Steps per claim, with progress **saved after each one**, so a retry resumes instead of repeating:

1. Upload each held file; save its reference.
2. Register the signing key on the DID, if missing.
3. Replace placeholders with the uploaded references. If any placeholder has no upload, stop: never sign a claim with a missing file.
4. Sign the credential, **once**. Save it.
5. Save it to storage; save the CID.
6. If the indexer already has that CID, the claim landed on an earlier try: finish.
7. Sign and broadcast. Save the transaction hash **before** broadcasting (in a callback fired after signing).
8. On success, delete the claim and its held files.

Outcomes:

| What happened | What to do |
| --- | --- |
| Network lost | Stop the whole run. Keep everything. No error shown. |
| Refused (no permission, bad data) | Save the reason on that claim, show it, carry on with the others. |
| Broadcast sent but not confirmed in time | Mark "Sent. Waiting for the chain to confirm it", not an error. Recheck on the next run. |
| Chain refused it | Wait about 4 seconds and check the indexer for the CID. If it's there, count it as sent. |
| A held file is missing from the phone | Save the error on that claim; don't sign. |

Waiting for chat or other background logins: wait up to 60 seconds, **quietly**. Never pop up a setup screen for a send the user didn't start.

### 3.5 Accounts, sessions and logout

- Each queued claim belongs to the account that made it, and sends **only** when that account is signed in. Never send another person's claim from a shared phone.
- Queued claims survive the session expiring. After signing in again, they send.
- A real logout from Settings: if claims are waiting, warn ("You have 2 claims waiting to send. Logging out deletes them from this phone.") and require a second tap ("Log out and delete them"). Then delete the queue and held files.
- Automatic logouts (session expiry, a "log out and try again" recovery step) **keep** the queue.

### 3.6 "Waiting to send" list

Shown on the task list and on the collection page (filtered to that collection). Each row shows:

- the title;
- "Saved <time>";
- "· N photos to upload";
- the status: "Sending…", "Sends when you're back online", "Not sent: <reason>", or "Sent. Waiting for the chain to confirm it".

Buttons: "Send now" (disabled offline), and "Delete" with a second "Yes, delete it" tap.

A toast when claims send: "Your claim "<title>" was sent." or "3 claims were sent."

### 3.7 Not covered

- Sending with the app closed.
- Sub-claims and payment-approval claims offline.
- Claim-form code that was never loaded online on that phone. The warm-up in 2.3 covers most of it, but code a screen loads lazily (maps, PDF viewer) only saves after first use online.

## Traps found while building

- **Opaque responses eat storage.** Chrome counts each no-CORS cached response as about 7MB of quota, whatever its real size. 150 images could use the whole quota. Fetch in CORS mode, and don't save opaque responses.
- **Sign-in URLs carry one-time codes.** Never cache `/auth/*`. A cached sign-in callback replays a used code.
- **Query strings.** Cache pages by path only, or `?source=pwa` and tracking parameters make duplicate copies.
- **Another app on the same domain** with its own worker: bypass its path completely, and never delete caches you didn't create.
- **Development servers** often won't register a worker on `localhost` in embedded browsers. Test with a production build (`build` then `start`).
- **Testing on phones** needs HTTPS. A tunnel (cloudflared, ngrok) works. An app installed from one tunnel URL breaks when the URL changes.
- **Signing offline** is only safe to claim after testing it with the phone actually offline. The code path having no network calls isn't proof.

## Test checklist

Unit tests (fake the network, keys and IndexedDB):

- Sender: uploads, signs, saves, broadcasts, then forgets. Stops on lost network and resumes without re-uploading or re-signing. Doesn't broadcast when the CID is already indexed. Treats a chain refusal as success when the claim is found. Keeps a refused claim without stopping the others. Sends only the signed-in account's claims. Refuses to sign with a missing file. Does nothing while offline.
- Placeholders: find, replace, throw on unresolved, network-failure detection (including the "Upload failed: 413" false match).
- Saved balance and permissions: per account, wiped on logout.

On real devices:

- Android Chrome: install from the sheet, open from the icon with the server off, a shortcut, the update pill.
- iPhone Safari: the Share steps, Add to Home Screen, opens offline.
- Airplane mode: pick a photo, submit, see it waiting, turn signal on, watch it send. Confirm one claim on chain, not two.
- Shared phone: queue as user A, log in as user B, confirm nothing sends.
- A cheap Android phone on a throttled connection.

## Reference build (JAMBO)

| Area | Files |
| --- | --- |
| Manifest, icons, offline page | `public/manifest.webmanifest`, `public/icons/*`, `scripts/make-pwa-icons.py`, `public/offline.html` |
| Worker | `sw/sw.js`, `sw/kill-switch.js`, `scripts/build-sw.js`, headers in `next.config.js` |
| Page side | `lib/pwa/serviceWorker.ts`, `lib/pwa/install.ts`, `lib/pwa/displayMode.ts`, `lib/pwa/warmUp.ts`, `components/Pwa/Pwa.tsx` |
| Saved data | `lib/pwa/userData.ts`, `utils/entity.ts`, `screens/collectionDetail.tsx`, `screens/wallet.tsx` |
| Offline claims | `lib/pwa/outbox/db.ts`, `lib/pwa/outbox/heldFiles.ts`, `lib/pwa/outbox/claims.ts`, `components/Pwa/Outbox.tsx`, `constants/surveyDefaultConfig.ts`, `screens/collectionForm.tsx` |
| Logout | `providers/auth.tsx`, `screens/settings.tsx` |
| Docs | `docs/pwa.md` (how it works), `docs/pwa-plan.md` (roadmap and signing findings) |
