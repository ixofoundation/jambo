# Admin management of base↔sub claim-collection linkages

## Context

The subclaim ("gated claim") feature discovers a collection's base collection(s) via the jambo worker's `collection_links` table, but links can currently only be created with the shared `COLLECTION_REGISTRY_TOKEN` secret (curl) or manual D1 inserts, and there is **no delete path at all**. This plan adds admin (existing `admin_whitelist`, matrix-admin auth) management of these links: view a collection's base/sub links, add a link, remove a link — from the existing admin UI at `/settings/entities/[entityDid]`, with pickers scoped to that entity's non-blacklisted collections. Decisions confirmed with the user: existing admin whitelist only; per-collection UI inside the entity screen; links must be same-entity.

Two repos are touched:
- Worker: `~/Documents/github/ixofoundation/ixo-yoma-jambo-worker` (Cloudflare Worker, Hono, D1)
- App: `~/Documents/github/ixofoundation/jambo-passkey-claims` (Next.js)

## Part 1 — Worker

### Routes (final state)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/collectiononcollection/:collectionId` | public | unchanged — `{collection, sub[], base[]}` (SubclaimModal depends on this shape) |
| GET | `/v1/collectiononcollection/collections/:collectionId` | public | unchanged |
| POST | `/v1/collectiononcollection/collections/:collectionId` | **bearer OR matrix-admin** | existing route, widened auth; body `{subCollectionId}`; message `'subcollection allowed'` |
| DELETE | `/v1/collectiononcollection/collections/:collectionId/:subCollectionId` | **matrix-admin** | new; idempotent 200, message `'subcollection link removed'` |

Decisions:
- **Keep the deployed bearer POST route** (registry-token integrations) and widen it with a combined middleware rather than forking a second admin route.
- **Same-entity validation in the worker, fail-open** (mirrors the GraphQL check precedent in `src/handlers/claims.ts:64-76`): resolve both collections' `entity` via `GRAPHQL_URL`; if both resolve and differ → 400 `'collections belong to different entities'`; on GraphQL failure log and proceed. Entity-whitelist/blacklist scoping stays a UI concern.
- POST validation order (cheapest first): non-empty ids (existing `requiredString`) → self-link (`collectionId === subCollectionId` → 400 `'collection cannot be linked to itself'`) → reverse 2-cycle (`isSubcollectionAllowed(db, subCollectionId, collectionId)` → 400 `'reverse link already exists between these collections'`) → fail-open same-entity check. Longer cycles (A→B→C→A) not detected — harmless (consumers traverse one level); note in a comment. No `^\d+$` regex on POST (deployed back-compat).
- DELETE validation: non-empty params + self-link 400. No entity check on DELETE (admins must be able to clean up bad/legacy links).

### File changes

- `src/services/collectionLinks.ts` — add `removeAllowedSubcollection(db, collectionId, subCollectionId)` (`DELETE FROM collection_links WHERE collection_id = ? AND sub_collection_id = ?`).
- `src/services/chainStatus.ts` — add `fetchCollectionEntity(graphqlUrl, collectionId): Promise<string | null>` following `fetchClaim`'s fetch/error conventions. Query shape (verify against live blocksync schema first — see Risks): `claimCollections(filter: {id: {equalTo: $id}}) { nodes { id entity } }`.
- `src/utils/combinedAuth.ts` — new `bearerOrMatrixAdminAuthMiddleware`: if Bearer token strictly equals `c.env.COLLECTION_REGISTRY_TOKEN` → `next()`; otherwise delegate to `matrixAdminAuthMiddleware`.
- `src/handlers/collectionLinks.ts` — extend `registerAllowedSubcollection` with the checks above; add `deleteAllowedSubcollection`.
- `src/index.ts` — swap POST middleware to the combined one; register the DELETE route. No CORS change (DELETE already allowed); no `schemas/schema.sql` change.

### Worker tests

- `test/helpers.ts`: extend `resetTables` to also clear `collection_links` and `claim_links` (known leak); extend `mockMatrixWhoami` with an optional GraphQL responder param (existing behavior unchanged when omitted).
- New `test/collectionLinks.test.ts` mirroring `test/entities.test.ts` (`applySchema`/`resetTables`/`seedAdmin`/`mockMatrixWhoami`): bearer POST back-compat; matrix-admin POST (200) / non-admin (403) / bad token (401); self-link 400; reverse-link 400; duplicate POST 200; different-entities 400; GraphQL-failure fail-open 200; DELETE admin 200 + link gone; DELETE nonexistent 200; DELETE with registry bearer 401/403; GET shape both directions.
- Run on Node 20: `fnm exec v20.18.1 yarn test` (per project memory).

## Part 2 — App

### Client (`lib/yomaWorker/client.ts`)

Add, following the `blacklistCollection`/`unblacklistCollection` pattern (matrix token, `safeFetch`, proxied via `/api/yomaWorker` — no proxy changes):

```ts
addCollectionLink(collectionId, subCollectionId, accessToken)    // POST .../collections/:collectionId  {subCollectionId}
removeCollectionLink(collectionId, subCollectionId, accessToken) // DELETE .../collections/:collectionId/:subCollectionId
```

`getCollectionLinks` + `CollectionLinksResponse` already exist — reuse; no `types.ts` change.

### Hook — new `hooks/useCollectionLinks.ts`

Modeled on `hooks/useCollectionBlacklist.ts` (local state + toasts + `secret.accessToken`, no redux — nothing else caches links):

```ts
useCollectionLinks(collectionId?) => {
  base: string[]; sub: string[]; loading: boolean;
  savingKeys: Set<string>;              // `${direction}:${otherId}`
  addLink(direction: 'base'|'sub', otherId); removeLink(direction, otherId); refresh();
}
```

`addLink('sub', other)` → `addCollectionLink(collectionId, other)`; `addLink('base', other)` → `addCollectionLink(other, collectionId)`; removes symmetric. On failure toast `res.message` (surfaces worker 400s like reverse-link/different-entities); `not-found` on GET → empty lists.

### UI — expandable inline panel (no new route)

- New `components/CollectionLinkagesPanel/CollectionLinkagesPanel.tsx` — props `{collection, allCollections, blacklist}`; inline styles with the existing CSS vars (matches `screens/entityCollections.tsx`). Two sections, "Base collections" (`base`: collections this one submits onto) and "Sub collections" (`sub`). Each row: id chip (reuse chip style from the screen's `CollectionCard`) + name from `allCollections` (`formName || 'Collection <id>'`); ids not in this entity's list (legacy cross-entity) render raw with a muted note, still removable. Remove = existing inline-confirm-strip pattern (no modal), per-row spinner via `savingKeys`. Per-section add picker: native `<select>` of candidates = entity's collections minus self, minus blacklisted, minus already-linked in that direction; "Add" button; empty → "No eligible collections". Loading / "No links yet" states.
- Modify `screens/entityCollections.tsx`: single-open accordion state (`expandedId`, reset on `entityDid` change); add a link-icon button next to `VisibilityButton` (same 32px hover style, `aria-expanded`); render the panel under the expanded card inside `listBoxStyle` (indented, top border). Panel mounts on expand → links fetch lazily. Update the header copy to mention linkages.
- **No changes** to `SubclaimModal`, `collectionForm`, or the API proxy — the public GET route/shape is untouched so subclaim discovery keeps working.

## Implementation order

1. Worker services → middleware → handlers → routes.
2. Worker tests (helpers extension + new suite), full suite green on Node 20.
3. App client fns → hook → panel component → wire into `entityCollections.tsx`.
4. App typecheck/build.
5. Deploy worker before the app (app calls the new DELETE route).

## Verification

- Worker: `fnm exec v20.18.1 yarn test` — new suite green, existing suites (`entities`, `admins`, `collections`, `matrixAuth`) still green.
- Verify the blocksync GraphQL query for `fetchCollectionEntity` with one manual curl against the configured `GRAPHQL_URL` (fail-open would silently mask a wrong query).
- App: typecheck (`tsc --noEmit` / repo script) + `next build`.
- Manual E2E: `wrangler dev` + local D1 with schema applied; as admin → `/settings/entities/[entityDid]` → expand a collection → add it as sub of another → both panels reflect the link; remove works; picker excludes self/blacklisted/linked; adding the reverse direction toasts the worker 400.
- Consumer path: after linking, as a normal user open the **sub** collection's claim form (template containing `ixo:baseClaimCID`) → SubclaimModal discovers the base collection and lists its approved claims. Sanity: `curl GET /v1/collectiononcollection/<subId>` shows the base id.

## Risks / notes

1. **GraphQL query shape** for collection→entity lookup must be verified against the live schema (`claimCollections` filter arg + id scalar type) before trusting the same-entity check.
2. Fail-open same-entity check is advisory — a direct API caller can create a cross-entity link during indexer downtime; UI scoping is the primary guard (matches existing `createLinkage` precedent).
3. Widening the deployed bearer POST route to also accept matrix-admin tokens is a behavior change on a live route; strict token equality is checked first and the back-compat test covers it.
4. Legacy cross-entity links render by raw id and remain removable by design.
