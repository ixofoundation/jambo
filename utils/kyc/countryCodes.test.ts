import { describe, expect, it } from 'vitest';

import { alpha3ToAlpha2 } from './countryCodes';

describe('alpha3ToAlpha2', () => {
  it('converts ISO 3166-1 alpha-3 codes', () => {
    expect(alpha3ToAlpha2('ZAF')).toBe('ZA');
    expect(alpha3ToAlpha2('NGA')).toBe('NG');
    expect(alpha3ToAlpha2('KEN')).toBe('KE');
    expect(alpha3ToAlpha2('GBR')).toBe('GB');
    expect(alpha3ToAlpha2('DEU')).toBe('DE');
    expect(alpha3ToAlpha2('USA')).toBe('US');
    expect(alpha3ToAlpha2('ABW')).toBe('AW');
    expect(alpha3ToAlpha2('ZWE')).toBe('ZW');
  });

  it('knows every ISO 3166-1 alpha-3 code, each mapped to a distinct alpha-2', () => {
    const found = new Set<string>();
    const A = 'A'.charCodeAt(0);
    for (let a = 0; a < 26; a++)
      for (let b = 0; b < 26; b++)
        for (let c = 0; c < 26; c++) {
          const code = String.fromCharCode(A + a, A + b, A + c);
          const alpha2 = alpha3ToAlpha2(code);
          // GB* and Kosovo pseudo-codes share an alpha-2 with a real entry.
          if (alpha2 && !/^GB[DNOPS]$|^RKS$|^XKX$/.test(code)) {
            expect(alpha2).toMatch(/^[A-Z]{2}$/);
            expect(found.has(alpha2)).toBe(false);
            found.add(alpha2);
          }
        }
    // ISO 3166-1 has 249 officially assigned codes.
    expect(found.size).toBe(249);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(alpha3ToAlpha2('zaf')).toBe('ZA');
    expect(alpha3ToAlpha2('  Nga \n')).toBe('NG');
  });

  it('passes alpha-2 input through, upper-cased', () => {
    expect(alpha3ToAlpha2('ZA')).toBe('ZA');
    expect(alpha3ToAlpha2(' ng ')).toBe('NG');
  });

  it('maps the passport pseudo-codes', () => {
    expect(alpha3ToAlpha2('D')).toBe('DE');
    expect(alpha3ToAlpha2('D<<')).toBe('DE');
    for (const code of ['GBD', 'GBN', 'GBO', 'GBP', 'GBS']) expect(alpha3ToAlpha2(code)).toBe('GB');
    expect(alpha3ToAlpha2('RKS')).toBe('XK');
    expect(alpha3ToAlpha2('xkx')).toBe('XK');
  });

  it('returns null for anything that is not a country code', () => {
    expect(alpha3ToAlpha2('')).toBeNull();
    expect(alpha3ToAlpha2('   ')).toBeNull();
    expect(alpha3ToAlpha2('XXX')).toBeNull();
    expect(alpha3ToAlpha2('ZZZZ')).toBeNull();
    expect(alpha3ToAlpha2('Z')).toBeNull();
    expect(alpha3ToAlpha2('12')).toBeNull();
    expect(alpha3ToAlpha2('South Africa')).toBeNull();
    expect(alpha3ToAlpha2(undefined as unknown as string)).toBeNull();
  });
});
