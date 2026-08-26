---
name: JAMBO yoma
description: The Deck · light edition — warm paper, white cards, one opportunity at a time.
colors:
  paper-beige: "#f7f5eb"
  card-white: "#ffffff"
  sand: "#efece0"
  border-sand: "#e5e2d4"
  input-sand: "#d9d5c6"
  aubergine: "#54365d"
  aubergine-deep: "#41204b"
  lilac-tint: "#ecdff1"
  forest-green: "#387f6a"
  forest-deep: "#2f6a59"
  mint-tint: "#e6f5f3"
  money-orange: "#e07b00"
  earned-yellow: "#f9ab3e"
  yellow-deep: "#e49526"
  ink: "#23202a"
  ink-muted: "#5b5860"
  ink-faint: "#928e97"
  error-red: "#fe4d57"
  warning-amber: "#d48414"
  info-blue: "#4cade9"
  brand-coral-ring: "#F4552E"
  brand-yellow-dot: "#FFD23F"
typography:
  display:
    fontFamily: "Nunito, system-ui, -apple-system, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Nunito, system-ui, -apple-system, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Nunito, system-ui, -apple-system, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Nunito, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Nunito, system-ui, -apple-system, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
rounded:
  input: "12px"
  thumb: "14px"
  row: "18px"
  card: "22px"
  sheet: "26px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  gutter: "20px"
  section: "22px"
  dock-clearance: "96px"
components:
  button-primary:
    backgroundColor: "{colors.forest-green}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "15px 24px"
  button-light:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "15px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "15px 24px"
  button-small:
    backgroundColor: "{colors.forest-green}"
    textColor: "#ffffff"
    rounded: "{rounded.input}"
    padding: "10px 17px"
  icon-button:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "42px"
  chip:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 15px"
  chip-active:
    backgroundColor: "{colors.forest-green}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "9px 15px"
  badge-ai:
    backgroundColor: "{colors.lilac-tint}"
    textColor: "{colors.aubergine}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  badge-match:
    backgroundColor: "{colors.mint-tint}"
    textColor: "{colors.forest-green}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.card}"
  status-item:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.row}"
    padding: "12px 14px"
  field:
    backgroundColor: "{colors.paper-beige}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "14px"
  meta-pill-pay:
    backgroundColor: "{colors.earned-yellow}"
    textColor: "#3d2c07"
    rounded: "{rounded.pill}"
    padding: "6px 11px"
  toast:
    backgroundColor: "rgba(43, 33, 51, 0.94)"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "9px 16px"
---

# Design System: JAMBO yoma

## Overview

**Creative North Star: "The Deck · Light Edition"**

The opportunity is the interface. Home is a deck of full-bleed photo cards — one real, verified opportunity at a time — and everything else in the app is quiet support for that decision. The world is warm and paper-like: a beige ground (`--bg-primary`), white 22px-radius cards floating on soft plum-tinted shadows, and Nunito set bold and tight everywhere. Chrome is summoned, never resident: navigation lives in a small floating pill until asked for, detail arrives in bottom sheets, and feedback is a dark whisper-pill at the top of the screen. The system was ported from the designer's coded prototype (`yoma-app`, "Yoma v2 — The Deck · light edition", `src/index.css`); the build in `styles/variables.scss` + `styles/globals.scss` is now the ground truth.

Color is rationed by meaning, not by decoration: aubergine speaks for the brand and AI, forest green is the one color of action, orange carries money, and yellow appears only at earned moments. Motion is CSS-only — spring-eased entrances and hand-rolled pointer physics on the deck — because low-end Android is the performance bar; `prefers-reduced-motion` collapses all of it to near-instant.

A deliberate engineering trait of this system: the token file keeps jambo's legacy variable names (`--bg-primary`, `--green-primary`, `--card-border-radius`, `--accent-color`, `--card-bg-color`…) alongside the prototype's new names (`--surface-2`, `--purple-tint`, `--mint`, `--coral`, `--r-card`, `--shadow-*`, the z scale). Pre-existing screens that were never touched by the redesign retint themselves through the cascade. New work should prefer the new names but must never delete the legacy aliases.

**Key Characteristics:**
- Warm paper ground, white cards, plum-tinted soft shadows — no grey, no dark bands.
- One typeface (Nunito), bold by default, negative tracking that tightens as size grows.
- Meaning-locked palette: green acts, aubergine brands, orange pays, yellow celebrates.
- Summoned chrome: dock pill, bottom sheets, top toast whisper.
- Fixed 400px mobile column at every viewport; CSS-only motion; nothing fabricated.

## Colors

A warm, meaning-rationed palette: one beige world, four voices that each own a single job.

### Primary
- **Forest Green** (`--green-primary`): the one color of action. Primary pill buttons, the big apply deck-action, active chips, the active dock item, "approved" status text, SurveyJS primary controls. Its pressed/darker partner is **Deep Forest** (`--green-secondary`).
- **Mint Tint** (`--mint`): quiet green wash for match/positive badges (`.badge--match`).

### Secondary
- **Aubergine** (`--purple-primary`, also `--accent-color`): the brand and AI voice, never the action voice. AI badges, trust-block icon chips, focus border on fields, wizard progress fill, own chat bubbles, unread pills. **Deep Aubergine** (`--purple-deep` / `--purple-secondary`) is its dark partner (also the stacked auth-screen logo ink).
- **Lilac Tint** (`--purple-tint`): aubergine's wash — tinted icon buttons, AI badge grounds, trust icons, wizard track, icon-button pressed state.

### Tertiary
- **Money Orange** (`--coral`): money and attention. Notification dots on icon buttons and dock items. Reserved for money figures when payment data ships.
- **Earned Yellow** (`--yellow-primary`): earned moments only — the pay meta-pill on cards (`.meta-pill--pay`, ink `#3d2c07`), the glowing match-interstitial dot, SurveyJS secondary. Darker partner **Deep Yellow** (`--yellow-secondary`).
- **Warning Amber** (`--warning-color`): "reviewing" status text, the save deck-action and SAVED stamp.
- **Error Red** (`--error-color`): errors and the PASS stamp.
- **Info Blue** (`--blue-primary`): legacy informational chips only; do not spend it on new surfaces.
- **Brand Coral Ring** + **Brand Yellow Dot**: fixed marks inside the yoma wordmark's 'o' only (`components/Brand/YomaWordmark.tsx`). Never reused as UI colors.

### Neutral
- **Paper Beige** (`--bg-primary` / `--surface-inset`): the app ground and inset panels (info lists, field boxes).
- **Card White** (`--surface` / `--bg-secondary`): every raised card, sheet, modal, dock.
- **Sand** (`--surface-2` / `--light-grey-color`): resting icon buttons, light buttons, chips, secondary bubbles.
- **Border Sand** (`--border-color`) and **Input Sand** (`--input-border-color`): hairlines and field strokes — warm, never grey.
- **Ink** (`--text-primary`), **Muted Ink** (`--text-secondary`), **Faint Ink** (`--text-nav`): the three text levels. Scrims and backdrops are plum-dark glass (`rgba(30, 22, 38, 0.44)` backdrop, `rgba(29, 23, 33, 0.72–0.78)` photo badges, `rgba(43, 33, 51, 0.94)` toasts) — dark surfaces in this world are always slightly purple, never pure black.

### Named Rules
**The Earned Yellow Rule.** Yellow appears only at earned moments — payment shown on a card, the match celebration, a saved opportunity. It is never a decorative accent.

**The One Green Rule.** Forest green means "this is the action" (or "this succeeded"). One green-filled element per decision context; everything else defers with sand, ghost, or tint treatments.

**The Aubergine Is Not A Button Rule.** Aubergine identifies the brand, AI, and progress; it fills chat bubbles, badges and focus rings, but never a primary call-to-action — that is green's job.

## Typography

**Display Font:** Nunito (with system-ui, -apple-system, sans-serif)
**Body Font:** Nunito (same family; weights 400/600/700/800/900 loaded via Google Fonts, wired through `constants/config.json` → `--font-family-name` in `pages/_document.tsx`)
**Mono Font:** ui-monospace / SFMono-Regular / Menlo (`--font-mono`) — account addresses only

**Character:** One rounded, friendly face doing everything, kept serious by weight and tracking: the bigger the text, the bolder the weight and the tighter the letter-spacing. Nothing in this app is thin.

### Hierarchy
- **Display** (800, 32px, 1.06, −0.02em): the deck-card title over the photo scrim. The same voice scales up for singular moments — 40px match-interstitial eyecatch, 42px wallet balance figure.
- **Headline** (700, 30px, −0.02em): screen-level `.h1`, balanced wrapping (`text-wrap: balance`).
- **Title** (700, 20–26px, −0.01em / −0.015em): `.title-lg` 26px, sheet headings 22px, `.h2` and section headers 20–21px, topbar/back titles 20px.
- **Body** (400–600, 16px, 1.5): base UI text (`--main-font-size`); emphasized rows go 700 at 16–17.5px. Secondary body is 14.5px muted.
- **Label** (600–700, 13–14.5px): field labels (14.5px/600 muted), status lines (13.5px/700), dock items (13px/700), badges (13.5px/700), the wordmark tagline (uppercase, ~3.5px letter-spacing — the only uppercase tracking-out in the system).

### Named Rules
**The Bold Ladder Rule.** Weight and tracking move together: 800/−0.02em for display, 700/−0.01em for titles, 600 for labels, 400 for reading text. Never set a heading below 700, and never track headings out.

**The One Face Rule.** Nunito everywhere. The only exception is `--font-mono` for on-chain addresses.

## Layout

One fixed mobile column, centred, at every viewport. `--max-width: 400px` bounds every screen; there are deliberately **no responsive media-query layouts**. The single `@media (min-width: 501px)` block adds two soft radial corner washes (lilac top-right, apricot bottom-left, fixed attachment) to the body so desktop shows the column on a gently lit paper stage — no fake phone bezel (user-confirmed).

The screen scaffold is `.screen` (flex column, `100dvh`) → `.topbar` (flex-none, 8/16px padding) → `.screen__scroll` (flex-1, hidden scrollbars) → optional `.bottom-cta` (safe-area padded). Horizontal gutters are 20px (`.pad`); stack gaps run 8px (`.hstack`), 10–14px between cards; section headers get 22px top margin. Screens that scroll under the dock pill add `.dock-clear` (96px `--dock-clearance` bottom padding). The fixed Header (60px `--header-height`) fades content out beneath it with a beige→transparent gradient instead of a hard chrome edge; bottom fixtures (dock, sheets, CTAs) all respect `env(safe-area-inset-bottom)`.

Stacking is two worlds: the design system's own z scale (`--z-sticky` 10, `--z-dock` 40, sheet scrim/sheet 50/51, match 60, toast 70) lives entirely **below 100**, because the preserved legacy modal ladder sits above it: 100 (Modal / SubclaimModal / PdfPreview) → 1200 (collectionForm overlays) → 1500 (background setup) → 2000 (signing) → 2100 (logging out) → 2200 (PIN / Yoma-mismatch prompts).

**The Under-100 Rule.** New design-system overlays (docks, sheets, interstitials, toasts) take z values on the 10–70 scale. Never claim 100+ — that ladder belongs to the preserved modal flows, in that order.

## Elevation & Depth

Soft, plum-tinted lift on a matte ground. Depth comes from three shadow tokens plus glass: raised elements cast warm shadows tinted with the world's dark plum (never neutral black), and floating chrome (dock, toast) is blurred translucent glass.

### Shadow Vocabulary
- **Soft** (`--shadow-soft: 0 2px 10px rgba(50, 40, 60, 0.09)`): resting cards, list rows, deck actions, toasts.
- **Card** (`--shadow-card: 0 10px 30px rgba(50, 40, 60, 0.16)`): the deck card, dock, credential passes, modals, match imagery — anything that hovers over the world.
- **Button** (`--shadow-btn: 0 6px 18px rgba(56, 127, 106, 0.32)`): primary green buttons and the apply deck-action only — the shadow is tinted with the button's own green.
- **Sheet lift** (`0 -14px 44px rgba(35, 27, 42, 0.22)`): bottom sheets, cast upward.

Glass treatments: dock `rgba(255,255,255,0.96)` + `blur(18px)`, dock pill `0.88` + `blur(14px)`, meta-pills `rgba(255,255,255,0.16)` + `blur(6px)` over photos, toasts dark plum glass + `blur(10px)`. Scrims: modal/sheet backdrop `rgba(30, 22, 38, 0.44)`, dock scrim `rgba(35, 27, 42, 0.38)` + `blur(3px)`.

Ambient depth also comes from light: `GradientBand` paints a per-area radial glow (purple/blue/green/yellow tints) at the top of a screen, masked to fade fully inside its own 30vh height.

**The Warm Shadow Rule.** Every shadow is plum-tinted `rgba(50, 40, 60, …)` or self-colored (the green button glow). No neutral-black shadows, no hard offsets.

**The Contained Glow Rule.** A tint band must fade to transparent inside its own bounds (mask `black 40% → transparent`); a glow still visible at its boundary produces a hard horizontal edge, which this world forbids.

## Shapes

Everything is rounded; nothing is sharp. Actions are pills (`--r-pill: 999px`) and circles (42px icon buttons, 34px section arrows, 56/68px deck actions). Containers follow a radius-grows-with-size scale: 12px inputs and small buttons → 14px thumbnails → 18px list rows and opportunity thumbs → 20px credential passes → 22px standard cards (`--r-card`) → 26px for the largest surfaces (deck card, modals, sheets — sheets round only their top corners, 26px 26px 0 0). Chat bubbles are 16px with one 4px "tail" corner toward the speaker. Borders are rare and light: 1px sand hairlines on inset cards and dividers, 1.5px on field boxes and ghost buttons (inset box-shadow), 1.5px dashed for the empty deck slot. The one angular gesture in the system is the deck stamp: a ±14° rotated pill-adjacent plate (14px radius, 3.5px solid border, 82% white ground) in the acting color — APPLY green, PASS red, SAVED amber.

**The No Corner Rule.** If it can be a pill or a circle, it is. Rectangular surfaces never go below 12px radius.

## Components

### Buttons (`.btn` family, globals.scss)
- **Character:** confident pills that physically respond to touch.
- **Shape:** full pill (999px); `.btn--sm` drops to 12px radius, 10px 17px padding, no shadow.
- **Primary** (`.btn--primary`): forest green fill, white 700/16px text, green-tinted shadow, 15px 24px padding.
- **Light / Ghost:** `.btn--light` sand fill; `.btn--ghost` transparent with a 1.5px inset sand ring.
- **States:** `:active` scales to 0.97 (0.12s); disabled fades to 0.45 opacity. `.btn--block` for full-width CTAs in `.bottom-cta`.
- The legacy `components/Button` (CSS-module color-matrix API) still exists for old screens; it retints via the aliased variables. New surfaces use the global `.btn` grammar.

### Icon buttons (`.iconbtn`, Header `.iconButton`)
42px circles on sand, ink stroke icons, pressed state flips to lilac tint; `.iconbtn--tint` is resident-lilac with aubergine ink. A 9px coral dot (2px paper ring) at top-right marks attention.

### Chips & badges
Chips: sand pills, 600/15px ink, 9px 15px; `.chip--active` fills forest green/white. Badges: smaller pills (7px 12px, 700/13.5px) — `.badge--ai` lilac/aubergine, `.badge--match` mint/green. On photos: `.price-tag` and `.corner-badge` sit on dark plum glass; `.meta-pill` is white glass (blur 6px), with `.meta-pill--pay` in earned yellow with dark-brown ink.

### Cards, list rows & info lists
`.card` = white, 22px, soft shadow; `.card--inset` = beige, hairline, no shadow. `.status-item` = tappable white row (18px radius, 52px thumb at 14px radius or round, 700/16.5px title, 14.5px muted meta, pressed→sand). `.list-card` groups rows with inset 1px sand dividers. `.info-list` = beige inset stack of icon+fact rows; the `--ai` variant inks icon and title aubergine. `.cred-card` = 20px-radius pass with card shadow. Status words: `.approved` green, `.reviewing` amber, both 700/13.5px.

### Fields (`.field`)
Label above (14.5px/600 muted), box on paper beige with 1.5px sand stroke, 12px radius, 14px padding, 16px text; focus recolors the stroke aubergine (0.15s); placeholder in faint ink. Chat input is the pill variant. SurveyJS claim forms live in the same world via `constants/surveyTheme.ts` + the "SurveyJS claim forms" block in `globals.scss`: the survey ground is transparent (the paper shows through — `collectionForm.tsx` paints `--bg-primary`), each question is its own white 18px card with `--shadow-soft` (`isPanelless: false`), inputs take this `.field` grammar (paper-inset fill, 1.5px sand stroke carried by `--sjs-shadow-inner`, aubergine focus), nav buttons are pills (Complete = green with `--shadow-btn`), page progress follows the wizard grammar (lilac track, aubergine fill, no label), question numbers are hidden, and error red is darkened to `#c22531` for 4.5:1 text contrast. The companion CSS uses triple-class selectors because `defaultV2.min.css` is imported dynamically after globals.

### Sheets (`.sheet`)
Bottom-anchored white panels, 26px top corners, 44×5px sand grip, upward shadow, max-height 88dvh, safe-area padded, entering via `sheet-in` (0.34s spring). Scrim at `--z-sheet-backdrop`. Inside: 22px headings and `.trust-block` rows (40px lilac icon chip, 700/16px title, 14.5px muted body) separated by hairlines.

### Navigation — the summoned dock (`components/Dock/Dock.tsx`) [signature]
Navigation chrome does not live on screen. A floating glass pill (`.dock-pill`, bottom-center, chevron + current-area label) summons the full dock: a glass card (28px radius, max column width minus 28px) with 4–5 items (Deck / Tasks / Wallet / Profile / conditional Help), each an icon over a 13px/700 label, active in forest green with stroke-width bumped 2→2.4. A plum scrim closes it; it closes itself on navigation; it hides on `/auth` and mid-flow wizard routes and for logged-out users. Coral dots mark items needing attention.

### The deck (`screens/deck.tsx` + `components/Deck/DeckCard.tsx`) [signature]
The home surface: a stack of full-bleed 26px-radius photo cards (stacked depth = scale 1−0.045·depth, translateY 14px·depth, fading beyond the second card). Each card: entity photo (or one of four gradient fallbacks), a fixed plum scrim heaviest at the base, provider line with mint check ("Verified partner"), 32px/800 white title, glass meta-pills. Physics are hand-rolled pointer events + CSS transforms — drag rotates at 0.055°/px, stamps fade in proportionally, release past ±110px (or 0.65 px/ms fling) flies the card out (0.32s accelerate curve), otherwise it springs back (0.35s). Right = APPLY, left = PASS, up = SAVED; the 56/68px action circles beneath drive the identical physics, so every gesture has a tap equivalent. Card text over photos is always white — theme-independent (**The Scrim Ink Rule**).

### Match interstitial (`.match`)
The earned-moment celebration: full-screen paper wash with a lilac radial glow, 40px/800 eyecatch, 132px/30px-radius image popping in at −4°, and a glowing yellow dot (`box-shadow: 0 0 26px 6px rgba(249,171,62,0.5)`). Reserved for real outcomes (approved claim, payout) — not yet mounted anywhere, awaiting its real trigger.

### Toasts (react-toastify, restyled in globals.scss)
One quiet grammar: a centred top pill of dark plum glass, white 600/14px text, no icon, no close button, no progress bar. Feedback whispers; it never shouts.

### Wizard progress (`.wizard-progress`)
4px lilac track segments, done segments fill aubergine.

### Chat (`.bubble`, `.convo-row`)
Own messages: aubergine bubbles, white ink, bottom-right tail; theirs: sand, ink, bottom-left tail; 16px radius, 16.5px text. Aubergine unread pills. This grammar carries the real Matrix support chat.

### Icons (`components/Icons/icons.tsx`)
One stroke system: 40 Lucide-path icons (ISC) on a 24px grid, `stroke: currentColor`, 2px round caps/joins; sizes 13–22px in context; active states thicken to 2.4. No filled glyphs, no icon fonts, no emoji-as-icon. **Gotcha:** SVG presentation attributes cannot hold `var()` — pass CSS variables via `style={{ stroke: 'var(--green-primary)' }}` (HeaderStatusIndicator precedent), or rely on `currentColor`.

### Brand mark (`components/Brand/YomaWordmark.tsx`)
Lowercase "yoma" in Nunito 800 with −2 tracking; the first 'o' is a coral ring (#F4552E, 7.5 stroke) with a yellow dot (#FFD23F) resting on top. Inline wordmark letters follow theme ink (`var(--text-primary)`); the stacked auth logo fixes deep-aubergine letters and adds the uppercase IMPACTS EXCHANGE tagline. Ring and dot colors never change.

### Motion (system-wide)
CSS keyframes only, no animation library: `rise-in` 0.45s / `dock-in` 0.28s / `sheet-in` 0.34s on the spring-out curve `cubic-bezier(0.16, 1, 0.3, 1)`; `fade-in` 0.25s; `pop-in` 0.45s (scale 0.72, −8°→−4°); deck fly-out on the accelerate curve `cubic-bezier(0.32, 0, 0.67, 0)`; press feedback 0.12–0.15s transitions. `prefers-reduced-motion: reduce` forces every animation and transition to 0.01ms globally.

## Do's and Don'ts

### Do:
- **Do** build new screens on the scaffold: `.screen` → `.topbar` → `.screen__scroll` (+ `.pad`), with `.bottom-cta` for pinned actions and `.dock-clear` on anything that scrolls under the dock pill.
- **Do** use the global grammar (`.btn`, `.chip`, `.card`, `.status-item`, `.field`, `.sheet`) before writing new CSS — the system already has a shape for most needs.
- **Do** keep both token vocabularies alive: prefer the new names (`--surface-2`, `--r-card`, `--shadow-soft`) in new code, and leave the legacy aliases (`--card-bg-color`, `--accent-color`, `--button-border-radius`…) defined so untouched screens keep retinting through the cascade.
- **Do** give every gesture a visible tap equivalent (deck action buttons mirror the swipes) and keep touch targets ≥ 42px.
- **Do** color SVG strokes with `currentColor` or `style={{ stroke: 'var(…)' }}` — never a `var()` in a presentation attribute.
- **Do** keep motion CSS-driven on the spring-out curve, and let `prefers-reduced-motion` kill all of it.

### Don't:
- **Don't** fabricate data to fill the comp's slots: payment/hours meta-pills, wallet activity, notifications feed, AI chat, and the Visa card are deliberately absent until real backing exists (see `.impeccable/surfaces/screens-deck-tsx.md` and `screens-wallet-tsx.md`). A surface shows real data or doesn't ship.
- **Don't** add `@media` responsive layouts — the app is a fixed 400px column everywhere; the only breakpoint is the ≥501px desktop stage wash. No phone bezel on desktop.
- **Don't** take z-index 100 or above for design-system overlays; the 100→2200 ladder belongs to the preserved modal flows.
- **Don't** spend the reserved colors: yellow outside earned moments, aubergine as a call-to-action, orange for anything but money/attention, info-blue on new surfaces.
- **Don't** add fonts, filled/glyph icon sets, animation libraries, pure-black shadows, or dark background bands (bands are light tints now — `GradientBand`).
- **Don't** put technical jargon in user-facing copy — "Vault", never "Matrix"; money words, never token words.
