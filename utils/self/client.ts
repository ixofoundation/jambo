import { SELF_KYC_ENABLED, SELF_WEB_URL } from '@constants/self';
import { ensureEd25519OnChain } from '@utils/ucanDelegation';
import type { SelfLinkCreateResult, SelfLinkErrorCode, SelfLinkStatusResult } from 'types/kyc';
import { mintSelfLinkDelegation, mintSelfOfferConsent } from './grants';
import { savePendingSelfLink } from './pendingLink';
import { serverNowSeconds } from './serverTime';

/**
 * Browser side of the Self identity check: signs the person's delegations and
 * calls Jambo's own routes (pages/api/self), which ask Self. Expected failures
 * come back as `{ outcome: 'error' }`, never as a throw.
 *
 * The delegations' expiries are counted from the server's time (./serverTime).
 * When the route still answers `clock_skew` (the device clock changed since the
 * offset was learnt), the offset is read again and the request made once more
 * with freshly signed delegations; nothing has reached Self at that point.
 *
 * The link URL in a `created` answer is a bearer secret: do not log, persist or
 * report it.
 */

const LINK_ID = /^[A-Za-z0-9-]{8,64}$/;

const NOT_CONFIGURED = 'The identity check is not available here yet.';
const UNAVAILABLE = "The identity check can't be reached right now. Please try again in a minute.";
const SIGN_IN_AGAIN = 'Please sign in again to verify your identity.';
const COULD_NOT_SIGN = "We couldn't sign the request. Please try again.";

function failure<C extends string>(code: C, message: string): { outcome: 'error'; code: C; message: string } {
  return { outcome: 'error', code, message };
}

/** A local signing failure: a missing key means the session is gone, anything else is a retry. */
function signingFailure(error: unknown): { outcome: 'error'; code: SelfLinkErrorCode; message: string } {
  const text = error instanceof Error ? error.message : '';
  return /mnemonic not available/i.test(text)
    ? failure('unauthorized', SIGN_IN_AGAIN)
    : failure('unknown', COULD_NOT_SIGN);
}

/** 32 hex characters; the server hashes it with the person's DID into Self's `requestKey`. */
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** POSTs JSON to one of Jambo's Self routes; null = no usable answer. */
async function postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin',
    });
    // The routes answer with the result union on every status they produce.
    const parsed: unknown = await response.json();
    return typeof parsed === 'object' && parsed !== null && typeof (parsed as any).outcome === 'string'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const isClockSkew = (answer: Record<string, unknown> | null): boolean =>
  answer?.outcome === 'error' && answer.code === 'clock_skew';

function isOnSelfOrigin(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url).origin === new URL(SELF_WEB_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Asks for a single-use identity-check link for the signed-in person. Makes sure
 * their Ed25519 key is on chain first (Self verifies the delegations against
 * it), which may show the signing modal once.
 */
export async function createSelfLink(args: {
  userDid: string;
  address: string;
  onSign: (messages: any[]) => Promise<unknown>;
}): Promise<SelfLinkCreateResult> {
  if (!SELF_KYC_ENABLED) return failure('not_configured', NOT_CONFIGURED);
  const { userDid, address, onSign } = args;

  // One nonce for both tries: it names this request (the server derives Self's `requestKey` from it).
  const nonce = randomNonce();
  let answer: Record<string, unknown> | null = null;
  try {
    await ensureEd25519OnChain({ did: userDid, address, onSign });
    for (let attempt = 0; attempt < 2; attempt++) {
      const [linkDelegation, offerConsent] = await Promise.all([
        mintSelfLinkDelegation(userDid),
        mintSelfOfferConsent(userDid),
      ]);
      answer = await postJson('/api/self/links', { linkDelegation, offerConsent, nonce });
      if (attempt > 0 || !isClockSkew(answer)) break;
      await serverNowSeconds({ refresh: true });
    }
  } catch (error) {
    return signingFailure(error);
  }
  if (!answer) return failure('unavailable', UNAVAILABLE);
  const result = answer as unknown as SelfLinkCreateResult;

  if (result.outcome === 'created') {
    // The server checks this too; a link that is not Self's is never handed to the page.
    if (!isOnSelfOrigin(result.url) || !LINK_ID.test(String(result.linkId))) return failure('unavailable', UNAVAILABLE);
    savePendingSelfLink(userDid, result.linkId);
    return result;
  }
  if (result.outcome === 'link_active') {
    if (result.linkId) savePendingSelfLink(userDid, result.linkId);
    return result;
  }
  if (result.outcome === 'already_verified') return result;
  if (result.outcome === 'error' && typeof result.code === 'string') {
    return { ...result, message: typeof result.message === 'string' ? result.message : UNAVAILABLE };
  }
  return failure('unavailable', UNAVAILABLE);
}

/**
 * Reads a link's status. A fresh delegation is signed for every call: it is what
 * proves to Jambo's route, and to Self, that the caller holds the person's key.
 */
export async function getSelfLinkStatus(args: { userDid: string; linkId: string }): Promise<SelfLinkStatusResult> {
  if (!SELF_KYC_ENABLED) return failure('not_configured', NOT_CONFIGURED);
  const { userDid, linkId } = args;
  if (!LINK_ID.test(linkId)) return failure('not_found', "We couldn't find this identity check.");

  let answer: Record<string, unknown> | null = null;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const linkDelegation = await mintSelfLinkDelegation(userDid);
      answer = await postJson(`/api/self/links/${encodeURIComponent(linkId)}`, { linkDelegation });
      if (attempt > 0 || !isClockSkew(answer)) break;
      await serverNowSeconds({ refresh: true });
    }
  } catch (error) {
    return signingFailure(error);
  }
  if (!answer) return failure('unavailable', UNAVAILABLE);
  const result = answer as unknown as SelfLinkStatusResult;
  if (result.outcome === 'status' && result.linkId === linkId && typeof result.status === 'string') return result;
  if (result.outcome === 'error' && typeof result.code === 'string') {
    return { ...result, message: typeof result.message === 'string' ? result.message : UNAVAILABLE };
  }
  return failure('unavailable', UNAVAILABLE);
}
