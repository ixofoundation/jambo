import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetServerTimeForTest, serverClockOffsetMs, serverNowSeconds } from './serverTime';

const DEVICE_NOW = Date.parse('2026-11-18T10:00:00.000Z');

/** A same-origin answer whose `Date` header says the server is `aheadMs` ahead of this device. */
function serverAhead(aheadMs: number | null) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const headers = new Headers();
    if (aheadMs !== null) headers.set('date', new Date(Date.now() + aheadMs).toUTCString());
    return new Response(null, { status: 204, headers });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(DEVICE_NOW);
  vi.stubGlobal('window', {});
  __resetServerTimeForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('serverNowSeconds', () => {
  it("learns the offset from the Date header of Jambo's own route, without a body or a cache", async () => {
    const fetchMock = serverAhead(10 * 60 * 1000);

    expect(await serverNowSeconds()).toBe(Math.floor(DEVICE_NOW / 1000) + 600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/self/links');
    expect(init).toMatchObject({ method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
  });

  it('corrects a device clock that is ahead as well as one that is behind', async () => {
    serverAhead(-25 * 60 * 1000);
    expect(await serverNowSeconds()).toBe(Math.floor(DEVICE_NOW / 1000) - 25 * 60);
  });

  it('is within a second for a clock that is right (Date has one-second resolution)', async () => {
    vi.setSystemTime(DEVICE_NOW + 900);
    serverAhead(0);
    expect(Math.abs(await serverClockOffsetMs())).toBeLessThanOrEqual(1000);
  });

  it('remembers the offset for ten minutes, and one probe serves callers that ask together', async () => {
    const fetchMock = serverAhead(60_000);
    await Promise.all([serverNowSeconds(), serverNowSeconds(), serverNowSeconds()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(9 * 60 * 1000);
    await serverNowSeconds();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * 60 * 1000);
    await serverNowSeconds();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks again on refresh, and takes the new offset', async () => {
    serverAhead(60_000);
    expect(await serverClockOffsetMs()).toBeGreaterThan(59_000);
    const fetchMock = serverAhead(-120_000);
    expect(await serverClockOffsetMs()).toBeGreaterThan(59_000);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await serverClockOffsetMs({ refresh: true })).toBeLessThan(-119_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('assumes no offset when the server cannot be asked, and does not ask again for a minute', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('network');
    });
    vi.stubGlobal('fetch', failing);
    expect(await serverClockOffsetMs()).toBe(0);
    expect(await serverNowSeconds()).toBe(Math.floor(DEVICE_NOW / 1000));
    expect(failing).toHaveBeenCalledTimes(1);

    const fetchMock = serverAhead(60_000);
    vi.advanceTimersByTime(61_000);
    expect(await serverClockOffsetMs()).toBeGreaterThan(59_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('assumes no offset when the answer has no readable Date', async () => {
    serverAhead(null);
    expect(await serverClockOffsetMs()).toBe(0);
  });

  it('keeps the offset it had when a refresh fails', async () => {
    serverAhead(60_000);
    const learnt = await serverClockOffsetMs();
    serverAhead(null);
    expect(await serverClockOffsetMs({ refresh: true })).toBe(learnt);
  });

  it('does not ask at all outside a browser', async () => {
    vi.unstubAllGlobals();
    const fetchMock = serverAhead(60_000);
    vi.stubGlobal('window', undefined);
    expect(await serverClockOffsetMs()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
