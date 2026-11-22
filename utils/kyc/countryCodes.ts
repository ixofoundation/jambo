import { toAlpha2CountryCode } from 'lib/here/countryCodes';

/**
 * Codes that appear in passports (ICAO 9303) but are not ISO 3166-1 alpha-3:
 * Germany's one-letter code, the British nationality classes, and Kosovo.
 */
const PASSPORT_PSEUDO_CODES: Record<string, string> = {
  D: 'DE',
  GBD: 'GB',
  GBN: 'GB',
  GBO: 'GB',
  GBP: 'GB',
  GBS: 'GB',
  RKS: 'XK',
  XKX: 'XK',
};

/**
 * ISO 3166-1 alpha-3 -> alpha-2 (the Self credential carries alpha-3; the ramp
 * forms and currency lookup use alpha-2). Accepts any case and surrounding
 * whitespace; a two-letter code passes through. Returns null for anything that
 * is not a known country code. The table itself is the complete ISO list in
 * lib/here/countryCodes.
 */
export function alpha3ToAlpha2(code: string): string | null {
  if (typeof code !== 'string') return null;
  // ICAO pads short codes with '<' (e.g. `D<<`).
  const upper = code.trim().toUpperCase().replace(/<+$/, '');
  const pseudo = PASSPORT_PSEUDO_CODES[upper];
  if (pseudo) return pseudo;
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (!/^[A-Z]{3}$/.test(upper)) return null;
  // The shared helper hands unknown codes back unchanged.
  const alpha2 = toAlpha2CountryCode(upper);
  return alpha2.length === 2 ? alpha2 : null;
}
