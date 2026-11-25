import { afterEach, describe, expect, it, vi } from 'vitest';

import { findHeldFileIds, isNetworkFailure, parseHeldRef, replaceHeldRefs } from './heldFiles';

const held = (id: string) => JSON.stringify({ jamboHeldFile: id, name: `${id}.jpg`, type: 'image/jpeg' });
const uploaded = (cid: string) => JSON.stringify({ id: `{id}#${cid}`, type: 'image/jpeg', serviceEndpoint: `https://vfs/${cid}` });

describe('held files', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tells placeholders from real uploads', () => {
    expect(parseHeldRef(held('a'))).toBe('a');
    expect(parseHeldRef(uploaded('x'))).toBeNull();
    expect(parseHeldRef('data:image/png;base64,AAAA')).toBeNull();
    expect(parseHeldRef('{"jamboHeldFile": 5}')).toBeNull();
    expect(parseHeldRef('jamboHeldFile but not json')).toBeNull();
    expect(parseHeldRef(undefined)).toBeNull();
  });

  it('finds placeholders at any depth, once each, and ignores real uploads', () => {
    const data = {
      name: 'Thandi',
      photos: [
        { name: 'a.jpg', type: 'image/jpeg', content: held('a') },
        { name: 'x.jpg', type: 'image/jpeg', content: uploaded('x') },
      ],
      visits: [{ evidence: [{ name: 'b.jpg', type: 'image/jpeg', content: held('b') }] }],
      again: [{ name: 'a.jpg', content: held('a') }],
    };
    expect(findHeldFileIds(data).sort()).toEqual(['a', 'b']);
    expect(findHeldFileIds({ photos: [{ content: uploaded('x') }] })).toEqual([]);
  });

  it('swaps every placeholder for its upload and leaves everything else alone', () => {
    const data = {
      name: 'Thandi',
      count: 3,
      ok: true,
      photos: [{ name: 'a.jpg', type: 'image/jpeg', content: held('a') }],
      visits: [{ evidence: [{ name: 'b.jpg', content: held('b') }] }],
      kept: [{ name: 'x.jpg', content: uploaded('x') }],
    };
    const out = replaceHeldRefs(data, { a: uploaded('A'), b: uploaded('B') });
    expect(out).toEqual({
      name: 'Thandi',
      count: 3,
      ok: true,
      photos: [{ name: 'a.jpg', type: 'image/jpeg', content: uploaded('A') }],
      visits: [{ evidence: [{ name: 'b.jpg', content: uploaded('B') }] }],
      kept: [{ name: 'x.jpg', content: uploaded('x') }],
    });
    // The input is not changed.
    expect(data.photos[0].content).toBe(held('a'));
    expect(findHeldFileIds(out)).toEqual([]);
  });

  it('refuses to produce answers that still hold a placeholder', () => {
    expect(() => replaceHeldRefs({ p: [{ content: held('a') }] }, {})).toThrow();
  });

  it('counts only connection failures as worth holding a file for', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkFailure(new Error('Load failed'))).toBe(true);
    expect(isNetworkFailure(new Error('Media upload failed: 413 Payload Too Large'))).toBe(false);
    expect(isNetworkFailure(new Error('Evidence upload failed: 403 forbidden'))).toBe(false);
    vi.stubGlobal('navigator', { onLine: false });
    expect(isNetworkFailure(new Error('anything'))).toBe(true);
  });
});
