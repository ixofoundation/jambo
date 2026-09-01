/**
 * Standalone palette for the demo videos (intentionally not importing the
 * app's CSS tokens — this package renders marketing/demo material, not app UI).
 * Loosely derived from the jambo app palette (styles/variables.scss):
 * purple #41204B/#5A2B68, accent #6B1787, yellow #F9AB3E, blue #4CADE9.
 */
export const theme = {
  eyebrow: "Yoma · How to",
  bg: "#140f1a",
  bgAccent: "#241733",
  panel: "#2b1d3a",
  text: "#f6f2f9",
  textDim: "#a898b8",
  brand: "#f9ab3e",
  brandSoft: "rgba(249, 171, 62, 0.25)",
  tap: "#4cade9",
  phoneFrame: "#3a2a4a",
  phoneBezel: "#0c080f",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;
