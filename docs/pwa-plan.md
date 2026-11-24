# PWA plan

Goal: make JAMBO yoma a PWA that works well for its real users. That means cheap Android phones (often 1–2GB of memory), data paid by the megabyte, and patchy signal (see `PRODUCT.md`).

Status on 24 Nov 2026: there is no manifest, no service worker and no offline page. `public/fallback-PZ7ynJ3wKcU6tlBi-KwOY.js` is a stray `next-pwa` build file, added by accident in `c33f4fc`. Delete it.

Play Store listing (Trusted Web Activity) is out of scope for now.

## Phase 1: Installable

Built. How it works: `docs/pwa.md`. Still needed: the real 1024px icon and the production domain check.

- Manifest with proper icons, a maskable icon, and shortcuts (Wallet, Tasks, Support).
- Our own install prompt, shown after a good moment (first claim submitted), not on first visit. A short "add to home screen" sheet on iPhone.
- Service worker that caches the app shell and shows a branded offline screen.
- Safe updates: an "Update ready" toast that never reloads in the middle of a claim form or `/auth/*`. A ready-made empty service worker (kill switch) for bad releases.
- PostHog events: prompt shown, installed, opened from the home screen.

## Phase 2: Fast and cheap on data

Built. See "Offline data" in `docs/pwa.md`. Not done: smaller images (needs an image-resizing service).

- Opportunity images and IPFS content cached on the phone, with a size cap. Opportunity and task lists show instantly from saved data, then refresh in the background.
- Save-Data mode: smaller images, no prefetching.
- Never cached: balances, YellowCard, KYC, auth hub, signing, Matrix PII. Balances show "as of <time>" from redux-persist.
- Logout wipes every cache and the offline queue (shared phones are common).
- Claim form templates (protocol entity linked resources) cached, so a new claim can be opened offline. This is what Phase 3 needs.

## Phase 3: Claims with no signal

### What the code does today (checked 24 Nov 2026)

`submitForm` in `screens/collectionForm.tsx` runs these steps in this order:

| Step | Needs network? | Code |
| --- | --- | --- |
| Load the Ed25519 signing key | No. Encrypted in localStorage | `secureLoad(ED_SIGNING_MNEMONIC)` |
| Check the key is on the user's DID document | **Yes**, chain query | `hasEd25519VerificationMethod` |
| Register the key if missing | **Yes**, chain transaction | `onSign([addVmMsg])` |
| Sign the claim as a Verifiable Credential | **No.** Local resolver, bundled JSON-LD contexts | `createVeramoAgent`, `signClaimCredential` (`utils/veramo.ts`) |
| Save the signed claim to the Claim Bot, get a CID | **Yes**, Matrix | `saveClaim` |
| Fetch the collection admin | **Yes**, blocksync | `fetchCollectionByCollectionId` |
| Sign and broadcast `MsgSubmitClaim` | **Yes**. Reads account number and sequence from the chain before signing, then broadcasts | `signAndBroadcastWithSessionKey` (`lib/authHub/signAndBroadcast.ts`) |

Photos and files upload **as soon as they are picked**, not on submit (`createAttachUploadHandler` in `constants/surveyDefaultConfig.ts`). Each upload needs the network: it fetches the VFS service DID, mints a UCAN, then uploads to VFS. If no connection, the upload fails and the form has no file.

The session lasts **24 hours** from sign-in (`SESSION_MAX_AGE_MS` in `providers/auth.tsx`). After that, `onSign` logs the user out and sends them to `/auth`.

Drafts already save the form answers and the form template (`claimDraftsSlice`, persisted by redux-persist), so a half-filled form survives a reload or closing the app.

### What this means

- The claim itself (the signed credential) **can be made offline**. Everything after it (Claim Bot, chain) has to wait for signal.
- The on-chain transaction **cannot be signed ahead of time**. It needs the account sequence (a counter that goes up with every transaction) from the chain, and any other transaction sent in the meantime would make it invalid. So it is signed at send time.
- Photos are the biggest gap. Offline, they must be held on the phone (IndexedDB) and uploaded on reconnect, before the claim is sent.
- A claim that waits more than 24 hours after sign-in cannot be sent without signing in again. It must stay safely queued through the re-login, not be lost.

### Design

1. Offline photo picks: compress as today, store the file in IndexedDB, and show it in the form as "waiting to upload".
2. Offline submit: sign the credential locally, put {credential, held files, collection ID} in an IndexedDB queue, and show "Saved, sends when you're back online".
3. On reconnect: upload held files, then Claim Bot, then chain. Uses Background Sync on Android Chrome (works with the app closed); otherwise retries when the app opens.
4. Files are referenced inside the signed credential. So either upload the files before signing, or sign only once files are uploaded. **Decision needed.** Simplest: sign at send time, not at submit time (signing is fast and local).
5. Session expired: keep the queue and prompt the user to sign in, then send. Logout from a *different* account must not send another person's queue.
6. Never send twice: remember the Claim Bot CID and the tx hash (`onSigned` already exists for this) before each step, so a retry resumes rather than repeats.
7. Needs the "must preserve exactly" rules for `collectionForm.tsx` kept intact (authz, VC signing, drafts, subclaims, map question).

Not tested yet: signing a credential with the phone actually offline. The code path has no network calls, but that needs proving on a device.

## Phase 4: Push notifications

- Pushes for: claim approved, payment received, support replied. Unread count on the app icon for support.
- iPhone: only for installed apps, iOS 16.4 or newer.
- Backend needed: store push subscriptions, send from where those events happen (claim bot, yoma worker, YellowCard callbacks). VAPID keys stored as secrets.

## Technical notes

- Next.js 12.1.6 is too old for current PWA plugins (Serwist needs Next 14+). Write the service worker by hand with Workbox.
- `/cleanup` is proxied to another app with its own service worker. Ours must ignore `/cleanup` entirely.
- Ask the browser to keep the app's storage after install (`navigator.storage.persist()`), so queued claims aren't deleted when the phone is low on space.
- Test on a real 1–2GB Android phone on a throttled connection, plus an iPhone. Lighthouse results in each PR.

## Needed from the team

| For | What |
| --- | --- |
| Phase 1 | App icon at 1024px (plus a padded version for maskable), home-screen name, production domain and Vercel environments. Is `netlify.toml` still used? |
| Phase 3 | Which claim collections are done in the field. Sign at send time OK? Is a 24-hour session too short for field work? |
| Phase 4 | Who owns the push backend, where subscriptions live, VAPID keys as secrets. |
| All | `/cleanup` service worker scope. Test phones. |
