# Names (IXO Names worker)

Names, avatars and Matrix user ids of other people and entities come from the
**IXO Names worker** (`ixoworld/ixo-names-worker`): one batched request
instead of a Blocksync query, a profile document and a Matrix profile read per
id.

| Network | Worker |
|---|---|
| mainnet | `https://names.ixo.earth` |
| testnet | `https://testnet.names.ixo.earth` |
| devnet | `https://devnet.names.ixo.earth` |
| local | none: names fall back to abbreviations, nothing is requested |

The URL follows `NEXT_PUBLIC_CHAIN_NETWORK` (`constants/names.ts`).
`NEXT_PUBLIC_NAMES_WORKER_URL` overrides it, e.g. a local worker. The value is
trimmed and must be `https://…` or `http://localhost` / `http://127.0.0.1`;
anything else is ignored with a `[names]` console warning and the network
default is used.

```env
# ixo-names-worker: pnpm run dev (port 8799, live devnet origins)
NEXT_PUBLIC_NAMES_WORKER_URL=http://localhost:8799
```

## The client

The client is the npm package `@ixo/names-client`, pinned exactly (`0.2.1`). Its
hooks are in `@ixo/names-client/react`, a separate entry, so non-React code stays
free of React. The app imports both only through `lib/names/index.ts` and
`hooks/useNames.ts`.

The client batches calls made within 10 ms into one request per field set: an
edge-cached `GET /v1/names` for up to 20 ids, else `POST /v1/resolve` (≤ 40 ids,
at most 4 in flight). It memoises each answer until the worker's
`cache.freshUntil`, backs off after failures and never rejects: on any failure
`display` is the canonical abbreviation (`ixo1cycg5…k3xq`). In a browser a GET
carries no `X-Client-Id`, because a custom header would force a CORS preflight
per URL, so only POSTs are attributed to jambo in the worker's logs.

The package is ESM-only, so it is in the `next-transpile-modules` list in
`next.config.js`: it is bundled and compiled with the app. Nothing calls
`require()` on it at runtime, which Vercel's functions refuse for ESM
(`ERR_REQUIRE_ESM`, run with `--no-experimental-require-module`), and browsers
get the same output as the rest of the app. To check a bump, build and run under
that flag and open a page that imports it:

```bash
yarn build
NODE_OPTIONS=--no-experimental-require-module npx next start
curl -I http://localhost:3000/profile/credentials/kyc
```

TypeScript 4.7 with `moduleResolution: node` ignores package `exports`; the
package's `typesVersions` gives it the types of `@ixo/names-client/react`.

- `lib/names/index.ts`: the app's single client (`getNamesClient()`,
  `X-Client-Id: jambo`, failures logged as `[names] …` warnings), include
  sets, `workerImage` and `resolveMatrixProfile`.
- `hooks/useNames.ts`: `useNames(ids, include)`, the package's hook over jambo's
  client → `{ results, resultFor, displayFor, loading }`. First render shows
  memoised answers or abbreviations (no flash, no request); one ask per change
  of the id set, none when every id is memoised; an incomplete answer is asked
  once more after 31 s. Rows that each call it in the same render share one
  request.

Render `display` (or `name` where an empty value reads better than an
abbreviation). Names are chosen by their holders: render them as text, never
through `dangerouslySetInnerHTML`, and do not auto-link them.

## What uses the worker

| Surface | Ids | Include |
|---|---|---|
| Subclaim modal agent rows (`components/SubclaimModal`) | agent addresses | `name`, `image` |
| Support senders (`hooks/useSupportProfilePrefetch.ts` → `prefetchMatrixProfile`) | `@did-ixo-<address>:<host>` user ids | `name`, `image`, `matrix` |

One field set per surface, and `fresh` is never used: every page load is served
from the worker's caches.

Support senders: the client's classifier decides what goes to the worker, and
of Matrix user ids that is only `@did-ixo-<address>:<host>`. The id goes in as it
is, and the answer (keyed by that id, `normalized` is the address) is about the
address: the host in the id selects nothing. So the answer is used only when
`matrix.userId` (the address's own homeserver, from its DID) equals the sender's
user id. Anyone can register `@did-ixo-<someone's address>` on another
homeserver; that account must not be shown with the real holder's name. A
complete worker answer is final, including "no name". The profile is read with
the user's Matrix session (`fetchMatrixProfileByUserId`) instead for every other
user id, an id that fails that check, an incomplete answer or a worker failure,
and when the worker has not answered within 3 s (a late answer is then used only
if the session read produced nothing). The result lands in the `matrixProfiles`
slice, which the support views read.

Images: `workerImage` uses the worker's image when it is an https URL, for every
kind and from any host, so an account avatar loads directly from the homeserver
its DID names. Avatar `<img>`s carry `referrerPolicy="no-referrer"` and fall back
to initials when they fail to load.

The agent rows used to look every agent up as `@did-ixo-<address>:<the
logged-in user's homeserver>` and only with a Matrix session; the worker looks
each address up on the homeserver its DID names, without a session.

## What intentionally stays

| Code | Why |
|---|---|
| Own profile (`fetchMatrixProfile` in `providers/auth.tsx` → `matrixProfile` slice: header, deck and profile avatars, analytics) | The user's own session read, right after Matrix login. The raw Matrix display name, not the worker's label/entity-account precedence, and fresh: the worker caches a Matrix profile for 30 min (a missing one for 6 h). |
| Entity profiles for the deck, dashboard and project list (`utils/entityProfiles.ts`, `profilesSlice`) | They show brand, description, location, type and the logo/hero distinction, which the worker does not return. |
| Entity profile in `fetchAllCollectionData` (`store/thunks/dataThunks.ts`) | Feeds the `profilesSlice` entry (name, logo, type) and is the only path that refreshes it: `ensureEntityProfiles` never re-fetches a complete, persisted profile. |
| Tasks rows (`screens/tasks.tsx`): entity name and thumbnail | `fetchAllCollectionData`, which this screen needs anyway for form names, already fetches each entity and its profile document into the persisted `profilesSlice`, so a worker request there would be pure overhead and would lose the instant first paint after a reload. The meta line is truncated with an ellipsis. |
| `fetchProtocolEntity` / `fetchProtocolEntities` (`utils/entity.ts`) | Full entity rows: linked resources (claim templates), owner (authz), settings, dates. |
| Collection names in the subclaim modal and tasks | Built from the protocol's survey template title, not the worker's "<protocol> #<id>" rule. |
| Own data-store room (`screens/settings.tsx`, `utils/roomBotMnemonic.ts`, `utils/signingMnemonic.ts`) | Resolved with the user's token and immediately followed by authenticated reads/writes of encrypted secrets; rooms created during registration must not hit the worker's cached "no room". The alias host also strips a `matrix.` prefix (`cleanMatrixHomeServerUrl`), which the worker does not. |
| Room bot recovery (`fetchEncryptedMnemonicFromRoomBot`) and claim/bid bots | Configured per deployment (`NEXT_PUBLIC_MATRIX_*_BOT_URL`). Signed recovery challenges and claims must not go to a URL derived from a DID document. (On mainnet the worker's bots for `mx.ixo.earth` equal these env values.) |
| Support room alias (`lib/matrix/support.ts`) | `#<entity>-sup:<host>` is not one of the worker's two aliases; needs the live session. |
| Dev bypass room lookup (`lib/authHub/devBypass.ts`) | Development-only path. |

## Limitations

- The worker reads Matrix profiles unauthenticated, so a homeserver that
  requires auth for profile reads gives no name: agent rows show the
  abbreviation and support senders the user id. The IXO homeservers serve
  profiles without auth today.
- A Matrix name or avatar changed in the last 30 minutes (a newly created
  profile: 6 hours) can still show the old value in agent rows and support.
- An `mxc://` avatar is the worker's unauthenticated media v3 thumbnail URL. A
  homeserver that switches to authenticated media stops serving it; the `<img>`
  `onError` handlers (subclaim rows, support `UserAvatar`, tasks thumbnails) then
  show initials or the placeholder icon. Plain `https://` avatars are passed as
  they are.
- `partial` answers (a transient worker-side failure) show the abbreviation.
  `useNames` asks once more after 31 s; support senders use the session read.
  Nothing retries in a loop.
