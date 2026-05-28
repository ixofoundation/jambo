import { ensureEd25519OnChain, mintDelegation } from '@utils/ucanDelegation';

import {
  buildAuthUserEmailCapabilities,
  buildCapabilities,
  getSubscription,
  subscribeLinked,
  type Subscription,
  type SubscriptionStatus,
} from './client';
import { getEmailNotifierWorkerDid } from './workerDid';

// - Invocation TTL is short defense-in-depth — a leaked Authorization header is
//   only replayable for ~60s.
// - The email delegation TTL must stay UNDER auth-hub's hard cap
//   (DELEGATION_MAX_LIFETIME_SECONDS=300); 240s leaves headroom for clock skew.
export const INVOCATION_TTL_SECONDS = 60;
export const EMAIL_DELEGATION_TTL_SECONDS = 4 * 60;
export const READ_TTL_SECONDS = 60;

/**
 * Reads the current subscription via a `notifier/read` delegation. Shared by the
 * settings hook and the global activation prompt so both check the same way.
 */
export async function readSubscriptionStatus({
  did,
  address,
}: {
  did: string;
  address: string;
}): Promise<Subscription | null> {
  const audience = await getEmailNotifierWorkerDid();
  const delegation = await mintDelegation({
    userDid: did,
    audience,
    capabilities: buildCapabilities('notifier/read', address),
    ttlSeconds: READ_TTL_SECONDS,
  });
  return getSubscription(delegation);
}

/**
 * Subscribes using the auth-hub linked email: ensures the on-chain Ed25519 key
 * exists (may broadcast a tx via `onSign`), then mints the subscribe invocation +
 * the auth/user/email delegation and posts them to the notifier.
 */
export async function subscribeLinkedEmail({
  did,
  address,
  onSign,
}: {
  did: string;
  address: string;
  onSign: (messages: any[]) => Promise<unknown>;
}): Promise<{ status: SubscriptionStatus; address: string }> {
  await ensureEd25519OnChain({ did, address, onSign });

  const audience = await getEmailNotifierWorkerDid();
  const invocation = await mintDelegation({
    userDid: did,
    audience,
    capabilities: buildCapabilities('notifier/subscribe', address),
    ttlSeconds: INVOCATION_TTL_SECONDS,
  });
  const emailDelegation = await mintDelegation({
    userDid: did,
    audience,
    capabilities: buildAuthUserEmailCapabilities(address),
    ttlSeconds: EMAIL_DELEGATION_TTL_SECONDS,
  });
  return subscribeLinked(invocation, emailDelegation);
}
