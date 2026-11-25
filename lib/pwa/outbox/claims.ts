/**
 * Claims submitted with no connection, and the code that sends them later.
 * See docs/pwa.md, "Offline claims".
 *
 * Sending runs in the page, never in the service worker: the signing keys and
 * the Matrix login live in the page's storage, which a worker can't read. So a
 * queued claim goes out when the app is open and online (on start, when the
 * connection returns, or on "Send now"), not with the app closed.
 *
 * The steps are the ones `submitForm` in screens/collectionForm.tsx runs for a
 * plain claim, in the same order, with one difference: held photos are
 * uploaded first. Progress is saved after every step, so a retry resumes and
 * never repeats a step that took effect:
 *
 *   1. upload held photos   → `uploaded`  (per photo)
 *   2. register signing key (only if the DID lacks it)
 *   3. sign the credential  → `signedVC`  (signed once: re-signing would change the claim ID)
 *   4. save to Claim Bot    → `claimCid`
 *   5. already on chain?    → done, if blocksync knows the claim ID
 *   6. MsgSubmitClaim       → `txHash` (saved before broadcast, via onSigned)
 *
 * Only plain claims are queued. Sub-claims and approve-payment claims need
 * live lookups, so their forms still need a connection.
 */

import { cosmos, ixo } from '@ixo/impactxclient-sdk';
import base58 from 'bs58';

import authConstants from '@constants/auth';
import { secureLoad } from '@utils/storage';
import { deriveEd25519KeyPairFromMnemonic, createVeramoAgent, signClaimCredential } from '@utils/veramo';
import { hasEd25519VerificationMethod, buildAddEd25519VerificationMsg } from '@utils/did';
import { ensureEd25519VerificationMethod } from '@utils/ensureSigningKey';
import { hasVfsSigner } from '@utils/ucanVfs';
import { withMatrixOpenIdRetry } from '@utils/matrix';
import { fetchClaimById, fetchCollectionByCollectionId } from '@utils/claims';
import { uploadClaimFileToVfs } from 'lib/vfs/claimMedia';
import { uploadFile } from 'lib/matrix/matrixClaims';
import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import { track } from 'lib/analytics/client';
import { AnalyticsEvents } from 'lib/analytics/events';
import { CLAIMS, askToKeepStorage, getAll, isOutboxAvailable, newId, put, remove } from './db';
import { deleteHeldFile, findHeldFileIds, isNetworkFailure, loadHeldFile, replaceHeldRefs } from './heldFiles';

export type QueuedClaim = {
  id: string;
  address: string;
  did: string;
  entityDid: string;
  collectionId: string;
  /** Shown in the list ("Waiting to send: <title>"). */
  title: string;
  /** The answers as submitted, held-photo placeholders included. */
  surveyData: Record<string, unknown>;
  createdAt: number;
  // Progress, saved after each step.
  uploaded?: Record<string, string>;
  signedVC?: unknown;
  claimCid?: string;
  txHash?: string;
  /** Broadcast, but the chain hadn't confirmed it before the wait ran out. Checked next round. */
  awaitingConfirmation?: boolean;
  lastError?: string;
  lastTriedAt?: number;
};

export type SendDeps = {
  address: string;
  did: string;
  onSign: (messages: any[], label?: string, options?: { onSigned?: (txHash: string) => void | Promise<void> }) => Promise<unknown>;
  /** Resolves once the Matrix login is ready (Claim Bot needs it). */
  waitForDataStore: () => Promise<void>;
  /** A Claim Bot client for the current Matrix login, or null if there is none. */
  claimBot: () => { claim: { v1beta1: { saveClaim: (...args: any[]) => Promise<any> } } } | null;
};

// ---------------------------------------------------------------------------
// State for the UI (useSyncExternalStore)
// ---------------------------------------------------------------------------

export type OutboxState = { claims: QueuedClaim[]; sending: boolean; loaded: boolean };

let state: OutboxState = { claims: [], sending: false, loaded: false };
const listeners = new Set<() => void>();

function setState(next: Partial<OutboxState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export function subscribeOutbox(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getOutboxState(): OutboxState {
  return state;
}

const EMPTY: OutboxState = { claims: [], sending: false, loaded: false };
export function getServerOutboxState(): OutboxState {
  return EMPTY;
}

export async function refreshOutbox(): Promise<void> {
  if (!isOutboxAvailable()) return;
  const claims = (await getAll<QueuedClaim>(CLAIMS)).sort((a, b) => a.createdAt - b.createdAt);
  setState({ claims, loaded: true });
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export async function enqueueClaim(
  claim: Omit<QueuedClaim, 'id' | 'createdAt'>,
): Promise<QueuedClaim> {
  const record: QueuedClaim = { ...claim, id: newId(), createdAt: Date.now() };
  await put(CLAIMS, record);
  askToKeepStorage();
  await refreshOutbox();
  track(AnalyticsEvents.PwaClaimQueued, {
    collectionId: claim.collectionId,
    entityDid: claim.entityDid,
    heldFiles: findHeldFileIds(claim.surveyData).length,
  });
  return record;
}

async function save(claim: QueuedClaim): Promise<void> {
  await put(CLAIMS, claim);
}

/** Remove a queued claim and its held photos (the user chose to delete it). */
export async function discardQueuedClaim(claim: QueuedClaim): Promise<void> {
  await Promise.all(findHeldFileIds(claim.surveyData).map((id) => deleteHeldFile(id).catch(() => undefined)));
  await remove(CLAIMS, claim.id);
  await refreshOutbox();
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type SendResult = { sent: QueuedClaim[]; stoppedOffline: boolean };

let running: Promise<SendResult> | null = null;

/**
 * Send this account's queued claims, oldest first. One run at a time: a call
 * during a run gets that run's result. Stops at the first connection failure
 * (the rest would fail the same way); other failures are recorded on that
 * claim and the run moves on.
 */
export function sendQueuedClaims(deps: SendDeps): Promise<SendResult> {
  if (running) return running;
  running = (async () => {
    setState({ sending: true });
    const result: SendResult = { sent: [], stoppedOffline: false };
    try {
      await refreshOutbox();
      for (const claim of state.claims.filter((c) => c.address === deps.address)) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          result.stoppedOffline = true;
          break;
        }
        try {
          await sendOne(claim, deps);
          result.sent.push(claim);
        } catch (err) {
          claim.lastTriedAt = Date.now();
          // Accepted for broadcast but not confirmed yet: not a failure. The next round
          // finds it on chain (step 5) and finishes.
          if (err instanceof SignBroadcastError && err.stage === 'maybe_sent') {
            claim.awaitingConfirmation = true;
            claim.lastError = undefined;
            await save(claim).catch(() => undefined);
            continue;
          }
          const offline = isNetworkFailure(err);
          claim.awaitingConfirmation = false;
          claim.lastError = offline ? undefined : err instanceof Error ? err.message : String(err);
          await save(claim).catch(() => undefined);
          if (offline) {
            result.stoppedOffline = true;
            break;
          }
          track(AnalyticsEvents.EditorFlowSubmissionFailed, {
            flowType: 'claim-submission',
            entityDid: claim.entityDid,
            collectionId: claim.collectionId,
            reason: claim.lastError || 'Failed to send queued claim',
          });
        }
      }
    } finally {
      await refreshOutbox().catch(() => undefined);
      setState({ sending: false });
      running = null;
    }
    return result;
  })();
  return running;
}

async function uploadHeld(file: File, claim: QueuedClaim, deps: SendDeps): Promise<string> {
  // Same choice as the form's uploader (constants/surveyDefaultConfig): VFS when the
  // signing key can be registered, the Claim Bot otherwise.
  if (hasVfsSigner()) {
    try {
      await ensureEd25519VerificationMethod({ did: deps.did, address: deps.address, onSign: deps.onSign });
      return (await uploadClaimFileToVfs(file, claim.collectionId, deps.did)).content;
    } catch (err) {
      if (isNetworkFailure(err)) throw err;
      console.warn('[outbox] VFS upload unavailable, using the Claim Bot:', err);
    }
  }
  return (await uploadFile(file, claim.collectionId, deps.did)).content;
}

async function sendOne(claim: QueuedClaim, deps: SendDeps): Promise<void> {
  if (claim.address !== deps.address || claim.did !== deps.did) throw new Error('This claim belongs to another account');
  claim.lastTriedAt = Date.now();

  // 1. Held photos.
  const heldIds = findHeldFileIds(claim.surveyData);
  claim.uploaded = claim.uploaded ?? {};
  for (const id of heldIds) {
    if (claim.uploaded[id]) continue;
    const record = await loadHeldFile(id);
    if (!record) throw new Error('A photo for this claim is missing from the phone. Delete the claim and submit it again.');
    const file = new File([record.blob], record.name, { type: record.type });
    claim.uploaded[id] = await uploadHeld(file, claim, deps);
    await save(claim);
  }
  const answers = replaceHeldRefs(claim.surveyData, claim.uploaded);

  // 2 + 3. Signing key on the DID, then the credential (once).
  if (!claim.signedVC) {
    const edMnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
    if (!edMnemonic) throw new Error('Signing key not available. Please sign in again.');
    const keyPair = deriveEd25519KeyPairFromMnemonic(edMnemonic);
    if (!(await hasEd25519VerificationMethod(deps.did, base58.encode(keyPair.publicKey)))) {
      await deps.onSign([buildAddEd25519VerificationMsg(deps.did, keyPair.publicKey, deps.address)]);
    }
    const agent = await createVeramoAgent(keyPair, deps.did);
    claim.signedVC = await signClaimCredential(agent, deps.did, answers);
    await save(claim);
  }

  // 4. Claim Bot → claim ID.
  if (!claim.claimCid) {
    await deps.waitForDataStore();
    const client = deps.claimBot();
    if (!client) throw new Error('Your data store is not ready yet. Try again in a moment.');
    const response = await withMatrixOpenIdRetry((token) =>
      client.claim.v1beta1.saveClaim(claim.collectionId, JSON.stringify(claim.signedVC), token, deps.did),
    );
    const cid = response?.data?.cid as string | undefined;
    if (!cid) throw new Error('Failed to submit claim');
    claim.claimCid = cid;
    await save(claim);
  }

  // 5. A previous attempt may have landed already.
  if (!(await fetchClaimById(claim.claimCid))) {
    // 6. On chain.
    const col = await fetchCollectionByCollectionId(claim.collectionId);
    const message = {
      typeUrl: '/cosmos.authz.v1beta1.MsgExec',
      value: cosmos.authz.v1beta1.MsgExec.fromPartial({
        grantee: deps.address,
        msgs: [
          {
            typeUrl: '/ixo.claims.v1beta1.MsgSubmitClaim',
            value: ixo.claims.v1beta1.MsgSubmitClaim.encode({
              adminAddress: col.admin as string,
              agentAddress: deps.address,
              agentDid: deps.did,
              claimId: claim.claimCid,
              collectionId: claim.collectionId,
              useIntent: false,
              amount: [],
              cw20Payment: [],
              cw1155Payment: [],
            }).finish(),
          },
        ] as any[],
      }),
    };
    try {
      await deps.onSign([message], 'Submit Claim', {
        onSigned: async (txHash) => {
          claim.txHash = txHash;
          await save(claim);
        },
      });
    } catch (err) {
      // Refused on chain: most likely the claim ID already exists from an earlier attempt
      // that wasn't indexed yet. Look once more before calling it a failure.
      if (err instanceof SignBroadcastError && err.stage === 'failed_on_chain') {
        await new Promise((r) => setTimeout(r, 4000));
        if (await fetchClaimById(claim.claimCid)) return finish(claim);
      }
      throw err;
    }
  }
  await finish(claim);
}

async function finish(claim: QueuedClaim): Promise<void> {
  track(AnalyticsEvents.EditorFlowSubmitted, {
    flowType: 'claim-submission',
    entityDid: claim.entityDid,
    collectionId: claim.collectionId,
    claimId: claim.claimCid as string,
  });
  await Promise.all(findHeldFileIds(claim.surveyData).map((id) => deleteHeldFile(id).catch(() => undefined)));
  await remove(CLAIMS, claim.id);
}
