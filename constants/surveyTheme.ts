/**
 * SurveyJS theme — claim forms in "The Deck · light edition" world.
 *
 * The survey no longer paints its own white sheet: it sits directly on the
 * app's paper-beige ground (`--sjs-general-backcolor-dim: transparent`), and
 * with `isPanelless: false` every question renders as its own white card —
 * the same white-card-on-paper grammar as the rest of the app. Inputs take
 * the `.field` treatment (paper-inset fill, 1.5px sand stroke via the inner
 * shadow, aubergine focus — the focus recolor lives in globals.scss), and
 * forest green stays the one color of action (nav buttons, checked states).
 *
 * Companion CSS (pill buttons, aubergine focus/progress, input radius) lives
 * in styles/globals.scss under "SurveyJS claim forms".
 */
export const themeJson = {
  cssVariables: {
    // ── Ground: transparent — the app's paper shows through ──
    '--sjs-general-backcolor-dim': 'transparent',

    // ── Question cards: white, row-radius, warm plum shadow ──
    '--sjs-general-backcolor': 'var(--surface)',
    '--sjs-general-backcolor-dark': 'var(--surface-2)',
    '--sjs-questionpanel-backcolor': 'var(--surface)',
    '--sjs-questionpanel-hovercolor': 'var(--surface)',
    '--sjs-questionpanel-cornerRadius': '18px',
    '--sjs-corner-radius': '18px',

    // ── Inputs — the .field grammar: paper inset, sand stroke ──
    '--sjs-general-backcolor-dim-light': 'var(--surface-inset)',
    '--sjs-general-backcolor-dim-dark': 'var(--surface-2)',
    '--sjs-editorpanel-backcolor': 'var(--surface-inset)',
    '--sjs-editorpanel-hovercolor': 'var(--surface-2)',
    '--sjs-editorpanel-cornerRadius': '12px',
    '--sjs-editor-background': 'var(--surface-inset)',
    // defaultV2 paints this inner shadow on text inputs — reused as the
    // field stroke so inputs carry the 1.5px sand ring without extra CSS.
    '--sjs-shadow-inner': 'inset 0 0 0 1.5px var(--input-border-color)',

    // ── Ink ──
    '--sjs-general-forecolor': 'var(--text-primary)',
    '--sjs-general-forecolor-light': 'var(--text-secondary)',
    '--sjs-general-dim-forecolor': 'var(--text-primary)',
    '--sjs-general-dim-forecolor-light': 'var(--text-secondary)',

    // ── Type: Nunito everywhere, bold titles (Bold Ladder) ──
    '--sjs-font-family': 'var(--font-family-name), system-ui, sans-serif',
    '--sjs-font-size': '16px',
    '--sjs-font-surveytitle-color': 'var(--text-primary)',
    '--sjs-font-surveytitle-weight': '800',
    '--sjs-font-pagetitle-color': 'var(--text-primary)',
    '--sjs-font-pagetitle-weight': '700',
    '--sjs-font-questiontitle-color': 'var(--text-primary)',
    '--sjs-font-questiontitle-weight': '700',
    '--sjs-font-questiontitle-size': '16px',
    '--sjs-font-questiondescription-color': 'var(--text-secondary)',
    '--sjs-font-editorfont-color': 'var(--text-primary)',
    '--sjs-font-editorfont-size': '16px',

    // ── Action green — The One Green Rule ──
    '--sjs-primary-backcolor': 'var(--green-primary)',
    '--sjs-primary-backcolor-light': 'var(--mint)',
    '--sjs-primary-backcolor-dark': 'var(--green-secondary)',
    '--sjs-primary-forecolor': '#ffffff',
    '--sjs-primary-forecolor-light': 'var(--text-primary-light)',

    // ── Secondary (rare in SurveyJS; the world's earned yellow) ──
    '--sjs-secondary-backcolor': 'var(--yellow-primary)',
    '--sjs-secondary-backcolor-light': 'rgba(249, 171, 62, 0.1)',
    '--sjs-secondary-backcolor-semi-light': 'rgba(249, 171, 62, 0.25)',
    '--sjs-secondary-forecolor': 'var(--text-primary)',
    '--sjs-secondary-forecolor-light': 'var(--text-secondary)',

    // ── Rhythm & depth: warm plum shadows only ──
    '--sjs-base-unit': '8px',
    '--sjs-shadow-small': 'var(--shadow-soft)',
    '--sjs-shadow-medium': 'var(--shadow-soft)',
    '--sjs-shadow-large': 'var(--shadow-card)',

    // ── Hairlines ──
    '--sjs-border-light': 'var(--border-color)',
    '--sjs-border-default': 'var(--input-border-color)',
    '--sjs-border-inside': 'var(--border-color)',

    // ── Specials ──
    // Error red darkened for 4.5:1+ on white (the world's #fe4d57 reads at
    // ~3.2:1 as text — same verdict-chip reasoning as the Yoma cash-out app).
    '--sjs-special-red': '#c22531',
    '--sjs-special-red-light': 'rgba(254, 77, 87, 0.1)',
    '--sjs-special-red-forecolor': '#ffffff',
    '--sjs-special-green': 'var(--green-primary)',
    '--sjs-special-green-light': 'rgba(56, 127, 106, 0.1)',
    '--sjs-special-green-forecolor': '#ffffff',
    '--sjs-special-blue': 'var(--purple-primary)',
    '--sjs-special-blue-light': 'var(--purple-tint)',
    '--sjs-special-blue-forecolor': '#ffffff',
    '--sjs-special-yellow': 'var(--yellow-primary)',
    '--sjs-special-yellow-light': 'rgba(249, 171, 62, 0.1)',
    '--sjs-special-yellow-forecolor': 'var(--text-primary)',
  },
  // false ⇒ each question is its own white card on the paper ground.
  isPanelless: false,
};
