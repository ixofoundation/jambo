import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import matrixProfilesReducer from '@store/slices/matrixProfilesSlice';

const ADDR = 'ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';
const USER_ID = `@did-ixo-${ADDR}:mx.ixo.earth`;

const h = vi.hoisted(() => ({
  store: null as unknown as ReturnType<typeof configureStore>,
  resolveMatrixProfile: vi.fn(),
  secret: { baseUrl: 'https://mx.ixo.earth', accessToken: 'token' as string | null },
}));

vi.mock('@store/index', () => ({
  get store() {
    return h.store;
  },
}));
vi.mock('./secrets', () => ({ secret: h.secret }));
vi.mock('lib/names', async (importOriginal) => ({
  ...(await importOriginal<typeof import('lib/names')>()),
  getNamesClient: () => ({}),
  resolveMatrixProfile: h.resolveMatrixProfile,
}));

import { NAMES_WORKER_WAIT_MS, prefetchMatrixProfile } from './matrixProfile';

const profiles = () => (h.store.getState() as any).matrixProfiles.byUserId;

beforeEach(() => {
  h.store = configureStore({ reducer: { matrixProfiles: matrixProfilesReducer } });
  h.resolveMatrixProfile.mockReset();
  h.secret.accessToken = 'token';
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sessionProfile = () =>
  vi.fn(
    async () =>
      new Response(JSON.stringify({ displayname: 'From Session' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );

describe('prefetchMatrixProfile', () => {
  it('fills matrixProfiles from the names worker without touching the Matrix session', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    h.resolveMatrixProfile.mockResolvedValue({ displayName: 'Thandi M', avatarUrl: 'https://mx.ixo.earth/a.png' });

    await prefetchMatrixProfile(USER_ID);

    expect(profiles()[USER_ID]).toMatchObject({ displayName: 'Thandi M', avatarUrl: 'https://mx.ixo.earth/a.png' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the session profile read when the worker cannot vouch for the user id', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ displayname: 'Support Admin', avatar_url: 'mxc://mx.ixo.earth/xyz' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    h.resolveMatrixProfile.mockResolvedValue(null);

    await prefetchMatrixProfile('@admin:mx.ixo.earth');

    expect(fetchSpy).toHaveBeenCalledWith('https://mx.ixo.earth/_matrix/client/v3/profile/%40admin%3Amx.ixo.earth', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(profiles()['@admin:mx.ixo.earth']).toMatchObject({
      displayName: 'Support Admin',
      avatarUrl: 'https://mx.ixo.earth/_matrix/media/v3/thumbnail/mx.ixo.earth/xyz?width=96&height=96&method=crop',
    });
  });

  it('a complete worker answer with no name is final: no session read, even with a session', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    h.resolveMatrixProfile.mockResolvedValue({ displayName: null, avatarUrl: null });

    await prefetchMatrixProfile(USER_ID);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(profiles()[USER_ID]).toMatchObject({ displayName: null, avatarUrl: null });
  });

  it('a stalled worker does not hold the name: the session read starts after NAMES_WORKER_WAIT_MS and wins', async () => {
    vi.useFakeTimers();
    const fetchSpy = sessionProfile();
    vi.stubGlobal('fetch', fetchSpy);
    let answer!: (v: unknown) => void;
    h.resolveMatrixProfile.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const done = prefetchMatrixProfile(USER_ID);
    await vi.advanceTimersByTimeAsync(NAMES_WORKER_WAIT_MS - 1);
    expect(fetchSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(profiles()[USER_ID]).toMatchObject({ displayName: 'From Session' });
    answer({ displayName: 'Late Worker', avatarUrl: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(profiles()[USER_ID]).toMatchObject({ displayName: 'From Session' });
  });

  it('a stalled worker and no session: the late worker answer is used when it arrives', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    h.secret.accessToken = null;
    let answer!: (v: unknown) => void;
    h.resolveMatrixProfile.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const done = prefetchMatrixProfile(USER_ID);
    await vi.advanceTimersByTimeAsync(NAMES_WORKER_WAIT_MS);
    expect(profiles()[USER_ID]).toBeUndefined();
    answer({ displayName: 'Late Worker', avatarUrl: null });
    await done;

    expect(profiles()[USER_ID]).toMatchObject({ displayName: 'Late Worker' });
  });

  it('a worker from before Matrix ids falls through to the session read (the real client)', async () => {
    const fetchSpy = sessionProfile();
    vi.stubGlobal('fetch', fetchSpy);
    const { createJamboNamesClient, resolveMatrixProfile } = await vi.importActual<typeof import('lib/names')>('lib/names');
    const client = createJamboNamesClient('https://names.example', async (url) => {
      const id = new URL(url).searchParams.get('ids') as string;
      const unknown = { id, kind: 'unknown', normalized: null, display: id, status: 'unresolved', complete: true };
      const answer = { ...unknown, name: null, selfChosen: false, cache: { hit: 'none', freshUntil: null } };
      return new Response(JSON.stringify({ results: { [id]: answer } }), { status: 200 });
    });
    h.resolveMatrixProfile.mockImplementation((_client, userId) => resolveMatrixProfile(client, userId));

    await prefetchMatrixProfile(USER_ID);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(profiles()[USER_ID]).toMatchObject({ displayName: 'From Session' });
  });

  it('ignores an empty user id', async () => {
    await prefetchMatrixProfile('');
    expect(h.resolveMatrixProfile).not.toHaveBeenCalled();
  });
});
