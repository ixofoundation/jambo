import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { UseNamesResult } from '@ixo/names-client/react';
import { useNames } from './useNames';

const ADDR = 'ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';

function render(ids: (string | null)[]): UseNamesResult {
  let seen: UseNamesResult | undefined;
  const Probe = () => {
    seen = useNames(ids);
    return null;
  };
  renderToString(createElement(Probe));
  return seen as UseNamesResult;
}

describe('useNames', () => {
  it('wraps the shared hook: results, displayFor and the abbreviation on first render, no request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { results, displayFor } = render([ADDR, null, ADDR, '']);

    expect(Object.keys(results)).toEqual([ADDR]);
    expect(results[ADDR]).toMatchObject({ display: 'ixo190vqd…x95q', name: null, complete: false });
    expect(displayFor(ADDR)).toBe('ixo190vqd…x95q');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
