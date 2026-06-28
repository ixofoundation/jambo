/**
 * Minimal country helpers for the off-ramp form. Names are derived at runtime
 * from ISO 3166-1 alpha-2 codes via `Intl.DisplayNames`, and flag emojis from
 * regional-indicator symbols — so there's no bundled country dataset.
 */

// ISO 3166-1 alpha-2 codes (sender KYC can be from any country).
export const ALPHA2_CODES: string[] = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AW', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BN', 'BO', 'BR', 'BS',
  'BT', 'BW', 'BY', 'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC',
  'EE', 'EG', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FR', 'GA', 'GB', 'GD', 'GE', 'GH',
  'GM', 'GN', 'GQ', 'GR', 'GT', 'GW', 'GY', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE',
  'IL', 'IN', 'IQ', 'IR', 'IS', 'IT', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KM',
  'KN', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU',
  'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MG', 'MK', 'ML', 'MM', 'MN', 'MR', 'MT',
  'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP',
  'NZ', 'OM', 'PA', 'PE', 'PG', 'PH', 'PK', 'PL', 'PT', 'PY', 'QA', 'RO', 'RS',
  'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SI', 'SK', 'SL', 'SN', 'SO',
  'SR', 'SS', 'ST', 'SV', 'SY', 'SZ', 'TD', 'TG', 'TH', 'TJ', 'TL', 'TM', 'TN',
  'TO', 'TR', 'TT', 'TW', 'TZ', 'UA', 'UG', 'US', 'UY', 'UZ', 'VC', 'VE', 'VN',
  'VU', 'WS', 'YE', 'ZA', 'ZM', 'ZW',
];

let displayNames: Intl.DisplayNames | null = null;
function regionNames(): Intl.DisplayNames | null {
  if (displayNames) return displayNames;
  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    displayNames = null;
  }
  return displayNames;
}

export function countryName(code: string): string {
  const upper = code.toUpperCase();
  return regionNames()?.of(upper) ?? upper;
}

export function flagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryLabel(code: string): string {
  const flag = flagEmoji(code);
  return `${flag ? `${flag} ` : ''}${countryName(code)}`;
}

export interface CountryOption {
  value: string;
  label: string;
}

export function countryOptions(codes: string[]): CountryOption[] {
  return codes
    .map((c) => ({ value: c.toUpperCase(), label: countryLabel(c) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const ALL_COUNTRY_OPTIONS: CountryOption[] = countryOptions(ALPHA2_CODES);
