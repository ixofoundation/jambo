# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: African youth (16–24, mostly Android phones, often 1–2GB devices and metered data) arriving from Yoma (yoma.world) via a hand-off link, or returning directly. They want a real next step — a task that pays, teaches, or grows a verified CV — without wading through portals. They sign in with their ixo account (auth hub); no seed phrases or crypto vocabulary in their path.

Secondary: organisation evaluators (EA role) reviewing submitted claims, and ixo/Yoma admins managing the entity whitelist (`/settings/entities`).

## Product Purpose

JAMBO yoma is the youth-facing app of the Yoma Impacts Exchange: browse verified opportunities (ixo entities), apply, do the work, submit claims with evidence (SurveyJS forms, photos, maps), get them evaluated, receive USDC, and build verifiable credentials tied to a DID. Success: a youth lands from Yoma, signs in with the same email (linking their Yoma account silently), completes a task, and is paid — with proof on their YoID/DID.

## Positioning

Every task completed here is simultaneously money (USDC via YellowCard on/off-ramp), verified proof (on-chain claims + Veramo credentials), and a stronger Yoma profile (verifications feed back to Yoma nightly). A gig board can't truthfully claim the verification loop; a wallet can't claim the opportunity loop.

## Operating Context

- Arrival: Yoma 302 → `/entities/<did>?yref=<partnerUserId>` → auth hub sign-in → silent DID↔Yoma email-link (worker `test.sync.yoma.ixo.earth`).
- Claims flow: entity dashboard → claim collection → SurveyJS form → Ed25519 signing → matrix claim bot; evaluators approve with payment.
- Money: USDC balance on ixo chain; deposit/withdraw through YellowCard (mobile money / bank).
- Support: Matrix-backed threads and DMs with the org/admins.
- Data sources: jambo worker (entity whitelist), chain RPC (authz grants, balances), blocksync GraphQL, cellnode/IPFS profile documents, Matrix (credentials, PII, chat).

## Capabilities and Constraints

- Next.js 12 (pages router), React 18.1, SCSS + CSS custom properties, redux-persist (`jambo-cache` v4). No `@media` queries today; the app is a fixed 400px centred column.
- MUST PRESERVE exactly (documented races/fixes): AuthGuard's `router.isReady` gate; `auth/callback`'s StrictMode + `ixo_code_used` guards and `window.location.replace` after `persistor.flush()`; `logout({preserveReturnTo})` semantics; yref capture/strip + once-per-session link check in `providers/yomaLink.tsx`; modal z-index ladder (100 → 1200 → 1500 → 2000 → 2100 → 2200); `collectionForm.tsx` logic (1394 lines: authz, VC signing, drafts, KYC redirect, subclaims, map question); matrix background setup contract (`awaitCompletion()` opens the details modal by design).
- Truth constraint: no fabricated features — notifications feed, AI chat, and Visa card from the design prototype are out of scope until real backing exists. Real Matrix support chat carries the prototype's messaging design.
- Deck interactions are client-side preferences (save/skip in local storage); applying/claiming remains the existing on-chain flow.

## Brand Commitments

- Binding visual reference: the designer's coded prototype at `/Users/michael/dev/ixo/yoma-app` ("Yoma v2 — The Deck · light edition", `src/index.css` is authoritative; `src/theme/tokens.ts` is dead code). Warm paper-beige ground, Nunito, aubergine `#54365d` (brand/AI), forest green `#387f6a` (primary actions), orange `#e07b00` (money), yellow `#f9ab3e` reserved for earned moments; 22px cards, pill buttons, summoned-dock navigation, swipe deck home.
- Yoma wordmark: lowercase "yoma" with coral-ring 'o' + yellow dot (assets exist in `public/images/` and the prototype).
- User-facing copy: plain, no crypto/matrix jargon ("Vault" never "Matrix"; tokens framed as everyday money).
- Desktop: plain centred mobile-width column on the beige ground — no fake phone bezel/status bar (user-confirmed 2026-08-19).

## Evidence on Hand

- Live opportunities on testnet (2 real: "Youth-Led Inclusion Storytelling", "The Dignity Project") with profile images/descriptions from cellnode/IPFS.
- Real credentials/PII in Matrix per user; real USDC balances; real YellowCard rails.
- Prototype imagery is licensed Unsplash bundled in yoma-app; production cards use each entity's own profile image.

## Product Principles

1. The opportunity is the interface — full-bleed cards carry the home screen; chrome is summoned, not resident.
2. One decision at a time — the deck presents a single card; depth is progressive (tap → details → apply).
3. Trust is visible, not asserted — verified provider, payment, and proof requirements are first-class card content.
4. Celebrate outcomes, not interactions — earned moments (approved claim, payout) get the cinematic treatment; everything else stays quiet and fast.
5. Nothing fake in production — every surface shows real data or doesn't ship.

## Accessibility & Inclusion

Body text ≥ 4.5:1 (scrims over imagery); touch targets ≥ 44px; every gesture has a visible tap equivalent (buttons under the deck, dock pill, arrow keys on desktop); `prefers-reduced-motion` swaps swipe physics and interstitials for crossfades. Low-end Android is the performance bar: no heavy runtime animation libraries on the hot path.
