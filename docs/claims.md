# Claims and Collections

Claims are verifiable data submissions recorded on the IXO blockchain, with sensitive form data stored off-chain in Matrix. Claims belong to **claim collections**, which are on-chain entities managed by an admin.

## Claim Collections

A claim collection is an on-chain entity with the following key fields:

| Field | Description |
| --- | --- |
| `id` | Unique collection identifier |
| `entity` | The parent entity DID that owns this collection |
| `admin` | Blockchain address of the collection administrator |
| `protocol` | Protocol entity DID (defines the claim form template) |
| `startDate` | When the collection opens for submissions |
| `endDate` | When the collection closes (0 or absent = always open) |
| `state` | 0 = Created, 1 = Active, 2 = Paused, 3 = Closed |
| `count` | Number of claims submitted |
| `quota` | Maximum number of claims allowed (0 = unlimited) |
| `evaluated` | Number of claims evaluated |
| `approved` / `rejected` / `disputed` | Evaluation counts by status |

### Date Enforcement

- If `endDate` has passed (and is non-zero), users **cannot** submit claims or apply as agents
- If `startDate` is in the future (and is non-zero), users **cannot** submit claims or apply as agents
- If `endDate` is absent, null, or epoch 0 -- the collection is **always open**
- If `startDate` is absent, null, or epoch 0 -- the collection is **already started**

When a collection is not open, the action button area shows "Collection has ended" or "Collection has not started yet" instead of the Apply/Claim buttons.

## Data Flow

```
Blockchain (GraphQL via Blocksync)
  |
  v
fetchCollectionsByEntityDid() (utils/claims.ts)
  |
  v
Redux Store (collectionsSlice) -- normalized by ID, indexed by entity DID
  |
  v
useProtocolCollections(entityDid) hook -- maps to ProtocolCollection[]
  |
  v
Dashboard / CollectionDetail screens
```

The `fetchAllCollectionData` thunk in `store/thunks/dataThunks.ts` orchestrates the full data fetch:

1. Fetch collections for the entity DID
2. Fetch protocol entities for each unique protocol DID
3. Resolve VCT templates and form names from protocol entity linked resources
4. Fetch entity profile (name, logo) from entity settings

## Protocol Entities

Each collection references a **protocol entity** that defines the claim form:

- The protocol entity has `linkedResource` entries (e.g., `#surveyTemplate`, `#vct`, `#vct-1`) that point to SurveyJS JSON form templates
- Service endpoints are resolved via `getServiceEndpoint()` in `utils/url.ts`
- Form data is fetched via `getAdditionalInfo()` in `utils/url.ts`
- Protocol entities are fetched and cached via `fetchProtocolEntity()` in `utils/entity.ts`

## Dashboard

The dashboard screen (`screens/dashboard.tsx`) is the main landing page after login:

- **Route**: `/entities/[entityId]`
- **Entity DID**: Comes from the route param; the set of available entities is sourced from the jambo worker whitelist (cached locally)
- **Shows**: All claim collections belonging to the entity, with:
  - Collection name (from protocol VCT template title)
  - Date info ("Ended ..." or "Started ...")
  - Per-collection auth status badge: `Agent` (green), `Pending` (orange), or none
- **Status check**: For each collection, queries on-chain authz grants and Bid Bot for bid status
- **Navigation**: Clicking a collection navigates to `/entities/[entityId]/claimCollections/[collectionId]`

## Collection Detail

The collection detail screen (`screens/collectionDetail.tsx`) shows a single collection:

- **Header**: Collection name, submission count (with quota if set)
- **Auth check**: Polls every 5 seconds for `SubmitClaimAuthorization` and `EvaluateClaimAuthorization` grants
- **Status banners** (shown based on auth state):
  - No authorization + no bid: "Apply as a service agent to start submitting claims."
  - Pending bid: "Application pending -- Your agent application is being reviewed."
  - Expired/not started: Shows date-based message in button area
- **Claims list**: Shows user's past claims with status badges (Pending, Approved, Rejected, Disputed). Clickable to view claim details in read-only mode.
- **Action button**: "Apply as Agent", "New Claim", or "Continue Claim" (if draft exists)

## Claim Submission Flow

When an authorized agent submits a claim:

1. **Open form**: Fetch the SurveyJS template from the protocol entity's linked resource. Render via SurveyJS with the app's custom theme (`constants/surveyTheme.ts`)

2. **Fill out form**: User completes the survey. Changes are auto-saved as a draft.

3. **Submit**: On completion, the following steps execute:
   1. **PIN prompt**: User enters their PIN
   2. **Signing mnemonic**: Decrypt the existing signing mnemonic from Matrix room state, or generate a new one and store it (encrypted with PIN)
   3. **Key derivation**: Derive an Ed25519 keypair from the signing mnemonic (`utils/veramo.ts`)
   4. **DID verification method**: If the user's DID doesn't have an Ed25519 verification method, add one on-chain via `MsgUpdateIidDocument`
   5. **Sign credential**: Create a Veramo agent, sign the survey data as a W3C Verifiable Credential (`signClaimCredential()`)
   6. **Store in Matrix**: Save the signed VC to the Claim Bot, which returns a CID (content identifier)
   7. **Blockchain transaction**: Broadcast `MsgSubmitClaim` (wrapped in `MsgExec` for authz) with the CID, collection ID, and agent details
   8. **Cleanup**: Clear draft, close survey, refresh claims and bids

### Key Files

| File | Purpose |
| --- | --- |
| `screens/collectionDetail.tsx` | Orchestrates the full submission flow |
| `utils/veramo.ts` | Ed25519 key derivation, Veramo agent creation, VC signing |
| `utils/signingMnemonic.ts` | Signing mnemonic generation, encryption, storage in Matrix |
| `utils/did.ts` | DID document checks, Ed25519 verification method registration |
| `store/slices/claimDraftsSlice.ts` | Draft persistence |

## Claim Drafts

Claim drafts are auto-saved as the user fills out a form:

- **Trigger**: `survey.onValueChanged` fires on every field change
- **Storage**: Redux store (`claimDraftsSlice`), keyed by `collectionId`
- **Persistence**: The slice is persisted via `redux-persist` (survives page refreshes)
- **Draft data**: `{ surveyMode, surveyTemplate, surveyData, updatedAt }`
- **Resume**: When returning to a collection with a draft, the button shows "Continue Claim" and restores the saved data
- **Discard**: User can discard a draft via the close confirmation dialog

## Viewing Claims

Users can view their past claims in read-only mode:

1. Click a claim in the claims list
2. Claim data is fetched from the Claim Bot (`queryClaim()`)
3. If the claim is a signed Verifiable Credential, the `credentialSubject` is extracted
4. The same SurveyJS template is loaded in `display` mode with the data pre-filled
5. The Complete button is hidden (`showCompleteButton: false`); page navigation remains enabled so users can review multi-page claims.

### Reading Claim Media

A file answer's `serviceEndpoint` is written by the claim's submitter, so it is untrusted input, and it is read as soon as the claim opens. `getSurveyFilePreview` and `getSurveyFileBlob` (`lib/matrix/matrixClaims.ts`) treat it like this:

| Link | What it gets |
| --- | --- |
| `…/api/fs/cid/…` on the configured VFS host (`VFS_BASE_URL`) | A fresh `fs/read` UCAN for that collection's lane (`lib/vfs/claimMedia.ts`) |
| Any other https host that publishes its own `did:web` (`did:web:<host>` at `/.well-known/did.json`) | A fresh 5-minute UCAN with that DID as audience, `can: "*"` on `ixo:matrix-claims-bot` (`utils/ucanClaimBot.ts`), no redirects |
| Any other https host | An unauthenticated read: no token, no cookies, no referrer |
| Not https | Nothing is fetched |

The viewer's Matrix OpenID token is never sent to these links. It goes only to the bots configured in `NEXT_PUBLIC_MATRIX_*_BOT_URL`.

There is no host allowlist, so claims bots on other homeservers work without configuration. The binding is what keeps a fake host harmless: `utils/serviceDid.ts` accepts a `did.json` (or a cached value) only when it names the link's own host, so a fake host can only ever get a token addressed to itself, which no real service accepts. `*` is used because deployed claims bots accept nothing narrower. They answer any other ability or resource as a guest.

The UCAN is verified against the viewer's IID document, so their ed25519 signing key must be registered on chain. Reads do not register it, because that would need a signed transaction. Without it, or when a read fails for any other reason, SurveyJS shows its file error state. A claims bot served over plain http (a local harness) gets no read.

## Claim Evaluation

Claim evaluation statuses are displayed as badges:

| Status | Value | Color |
| --- | --- | --- |
| Pending | (no evaluation) | Grey |
| Approved | `status === 1` | Green |
| Rejected | `status === 2` | Red |
| Disputed | `status === 3` | Amber |

Evaluation is performed externally by authorized Evaluation Agents via a separate admin interface (not part of this app's current UI).
