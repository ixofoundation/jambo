---
version: 1
slug: "screens-deck-tsx"
primary_target: "screens/deck.tsx"
related_targets: ["pages/index.tsx","components/Deck/DeckCard.tsx"]
---

Scope: the app home ("/" → screens/deck.tsx) — the opportunity deck. Visitor mode: Operate (decide on one opportunity at a time).

Audience & job: African youth arriving from Yoma or returning directly; pick a real next task that pays and grows a verified CV. Primary action: right-swipe / green apply button → opens the opportunity (`/entities/<did>`), where the real on-chain apply/claim flow lives.

Content & proof: cards are REAL whitelisted entities (jambo worker whitelist) with their own profile imagery, name, brand and location; "Verified partner" is true (relayer-verified). No payment/hours/skills meta on cards — that data doesn't exist yet; never fabricate it.

Constraints: left-swipe (pass) and up-swipe (save) are localStorage-only preferences (`yoma_deck_*`), never server state; hand-rolled pointer physics (no animation library — low-end Android bar); every gesture has button + arrow-key equivalents; tutorial card shows once (localStorage flag).

Chosen direction: designer's pinned prototype "The Deck · light edition" — full-bleed photo card with scrim, provider·Verified line, 32px Nunito title, meta pills, APPLY/PASS/SAVED stamps, actions row beneath, dock pill navigation. Memorable moment: the first card filling the screen with a real opportunity.

Unresolved: deck ordering is whitelist order (no recommender yet); search/tune overlay and match interstitial deliberately not built (skipped as unbacked); payment meta pill awaits real payment data per opportunity.
