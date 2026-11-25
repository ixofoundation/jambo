import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Everything that touches the network, the keys or IndexedDB is faked. The real
// placeholder helpers (heldFiles) and the real SignBroadcastError are used.
const h = vi.hoisted(() => ({
  store: new Map<string, any>(),
  files: new Map<string, any>(),
  onChain: new Set<string>(),
  calls: [] as string[],
  vcCount: 0,
  cidCount: 0,
  uploadFails: null as Error | null,
  chainFails: null as Error | null,
}));

vi.mock('./db', () => ({
  CLAIMS: 'claims',
  FILES: 'files',
  isOutboxAvailable: () => true,
  askToKeepStorage: () => undefined,
  newId: () => `id-${h.store.size + 1}`,
  put: async (_s: string, v: any) => void h.store.set(v.id, structuredClone(v)),
  getAll: async () => Array.from(h.store.values()).map((v) => structuredClone(v)),
  remove: async (_s: string, id: string) => void h.store.delete(id),
}));
vi.mock('./heldFiles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./heldFiles')>()),
  loadHeldFile: async (id: string) => h.files.get(id),
  deleteHeldFile: async (id: string) => void h.files.delete(id),
}));
vi.mock('@utils/storage', () => ({ secureLoad: () => 'ed mnemonic' }));
vi.mock('@utils/veramo', () => ({
  deriveEd25519KeyPairFromMnemonic: () => ({ publicKey: new Uint8Array([1, 2, 3]) }),
  createVeramoAgent: async () => ({}),
  signClaimCredential: async (_a: unknown, _d: string, data: unknown) => {
    h.calls.push('sign');
    h.vcCount += 1;
    return { vc: h.vcCount, credentialSubject: data };
  },
}));
vi.mock('@utils/did', () => ({
  hasEd25519VerificationMethod: async () => true,
  buildAddEd25519VerificationMsg: () => ({ typeUrl: 'add-vm' }),
}));
vi.mock('@utils/ensureSigningKey', () => ({ ensureEd25519VerificationMethod: async () => undefined }));
vi.mock('@utils/ucanVfs', () => ({ hasVfsSigner: () => true }));
vi.mock('@utils/matrix', () => ({ withMatrixOpenIdRetry: (call: (t: string) => unknown) => call('openid') }));
vi.mock('@utils/claims', () => ({
  fetchClaimById: async (cid: string) => (h.onChain.has(cid) ? { claimId: cid } : null),
  fetchCollectionByCollectionId: async () => ({ admin: 'ixo1admin' }),
}));
vi.mock('lib/vfs/claimMedia', () => ({
  uploadClaimFileToVfs: async (file: File) => {
    h.calls.push(`upload:${file.name}`);
    if (h.uploadFails) throw h.uploadFails;
    return { file, content: JSON.stringify({ serviceEndpoint: `https://vfs/${file.name}` }) };
  },
}));
vi.mock('lib/matrix/matrixClaims', () => ({ uploadFile: vi.fn() }));
vi.mock('lib/analytics/client', () => ({ track: (event: string) => h.calls.push(`track:${event}`) }));

import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import { enqueueClaim, getOutboxState, sendQueuedClaims, type SendDeps } from './claims';

const held = (id: string) => JSON.stringify({ jamboHeldFile: id, name: `${id}.jpg`, type: 'image/jpeg' });

function deps(overrides: Partial<SendDeps> = {}): SendDeps {
  return {
    address: 'ixo1alice',
    did: 'did:ixo:ixo1alice',
    waitForDataStore: async () => undefined,
    claimBot: () => ({
      claim: {
        v1beta1: {
          saveClaim: async (_c: string, vc: string) => {
            h.calls.push('saveClaim');
            h.cidCount += 1;
            return { data: { cid: `cid-${JSON.parse(vc).vc}` } };
          },
        },
      },
    }),
    onSign: async (messages: any[], _label?: string, options?: { onSigned?: (hash: string) => void | Promise<void> }) => {
      h.calls.push('broadcast');
      await options?.onSigned?.('HASH1');
      if (h.chainFails) throw h.chainFails;
      const claimId = 'cid-' + h.vcCount;
      h.onChain.add(claimId);
      return { messages };
    },
    ...overrides,
  };
}

async function queue(surveyData: Record<string, unknown>, address = 'ixo1alice') {
  return enqueueClaim({
    address,
    did: `did:ixo:${address}`,
    entityDid: 'did:ixo:entity',
    collectionId: '7',
    title: 'Storytelling',
    surveyData,
  });
}

describe('sendQueuedClaims', () => {
  beforeEach(() => {
    h.store.clear();
    h.files.clear();
    h.onChain.clear();
    h.calls.length = 0;
    h.vcCount = 0;
    h.cidCount = 0;
    h.uploadFails = null;
    h.chainFails = null;
    vi.stubGlobal('navigator', { onLine: true });
    h.files.set('a', { id: 'a', name: 'a.jpg', type: 'image/jpeg', blob: new Blob(['a']) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uploads held photos, signs the uploaded answers, saves, broadcasts, then forgets the claim', async () => {
    await queue({ story: 'hi', photos: [{ name: 'a.jpg', content: held('a') }] });

    const { sent } = await sendQueuedClaims(deps());

    expect(sent).toHaveLength(1);
    expect(h.calls.filter((c) => !c.startsWith('track'))).toEqual(['upload:a.jpg', 'sign', 'saveClaim', 'broadcast']);
    expect(h.store.size).toBe(0);
    expect(h.files.has('a')).toBe(false);
    expect(getOutboxState().claims).toHaveLength(0);
  });

  it('stops on a lost connection, keeps the claim, and resumes without re-uploading or re-signing', async () => {
    await queue({ photos: [{ name: 'a.jpg', content: held('a') }] });

    h.chainFails = new TypeError('Failed to fetch');
    const first = await sendQueuedClaims(deps());
    expect(first).toEqual({ sent: [], stoppedOffline: true });
    const saved = Array.from(h.store.values())[0];
    expect(saved.uploaded.a).toContain('https://vfs/a.jpg');
    expect(saved.signedVC).toBeTruthy();
    expect(saved.claimCid).toBe('cid-1');
    expect(saved.txHash).toBe('HASH1');
    expect(saved.lastError).toBeUndefined();

    h.chainFails = null;
    h.calls.length = 0;
    const second = await sendQueuedClaims(deps());
    expect(second.sent).toHaveLength(1);
    // Same signed claim, same claim ID: only the broadcast is repeated.
    expect(h.calls.filter((c) => !c.startsWith('track'))).toEqual(['broadcast']);
    expect(h.vcCount).toBe(1);
    expect(h.cidCount).toBe(1);
  });

  it('does not broadcast again when the claim is already on chain', async () => {
    await queue({ story: 'x' });
    h.chainFails = new SignBroadcastError('maybe_sent', 'HASH1', new Error('was submitted but was not yet found on the chain'));
    await sendQueuedClaims(deps());
    // Not an error: shown as waiting for confirmation.
    const waiting = Array.from(h.store.values())[0];
    expect(waiting.awaitingConfirmation).toBe(true);
    expect(waiting.lastError).toBeUndefined();
    // It landed after all.
    h.onChain.add('cid-1');
    h.chainFails = null;
    h.calls.length = 0;

    const { sent } = await sendQueuedClaims(deps());

    expect(sent).toHaveLength(1);
    expect(h.calls).not.toContain('broadcast');
    expect(h.store.size).toBe(0);
  });

  it('treats a chain refusal as success when the claim turns out to be there', async () => {
    vi.useFakeTimers();
    await queue({ story: 'x' });
    h.chainFails = new SignBroadcastError('failed_on_chain', 'HASH1', new Error('claim already exists'));
    const run = sendQueuedClaims(
      deps({
        onSign: async (_m, _l, options) => {
          await options?.onSigned?.('HASH1');
          h.onChain.add('cid-1'); // indexed a moment later
          throw h.chainFails;
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(5000);
    const { sent } = await run;
    vi.useRealTimers();

    expect(sent).toHaveLength(1);
    expect(h.store.size).toBe(0);
  });

  it('records a refusal on the claim and keeps it, without stopping the others', async () => {
    await queue({ story: 'first' });
    await queue({ story: 'second' });
    let n = 0;
    const { sent, stoppedOffline } = await sendQueuedClaims(
      deps({
        onSign: async () => {
          n += 1;
          if (n === 1) throw new Error('unauthorized: no SubmitClaimAuthorization');
          h.onChain.add(`cid-${h.vcCount}`);
          return {};
        },
      }),
    );

    expect(stoppedOffline).toBe(false);
    expect(sent).toHaveLength(1);
    const left = Array.from(h.store.values());
    expect(left).toHaveLength(1);
    expect(left[0].lastError).toContain('unauthorized');
  });

  it('only sends the signed-in account’s claims', async () => {
    await queue({ story: 'bob' }, 'ixo1bob');
    const { sent } = await sendQueuedClaims(deps());
    expect(sent).toHaveLength(0);
    expect(h.calls.filter((c) => !c.startsWith('track'))).toEqual([]);
    expect(h.store.size).toBe(1);
  });

  it('refuses to sign when a held photo is gone from the phone', async () => {
    await queue({ photos: [{ name: 'gone.jpg', content: held('gone') }] });
    await sendQueuedClaims(deps());
    expect(h.calls).not.toContain('sign');
    expect(Array.from(h.store.values())[0].lastError).toMatch(/missing/);
  });

  it('does nothing while the phone says it is offline', async () => {
    await queue({ story: 'x' });
    vi.stubGlobal('navigator', { onLine: false });
    const result = await sendQueuedClaims(deps());
    expect(result).toEqual({ sent: [], stoppedOffline: true });
    expect(h.calls.filter((c) => !c.startsWith('track'))).toEqual([]);
  });
});
