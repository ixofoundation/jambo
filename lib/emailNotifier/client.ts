import type { Capability } from '@ixo/ucan';

/**
 * Client for the ixo email-notifier worker (ixo-auth-hub/ixo-email-notifier).
 *
 * Every endpoint except `/api/events` and `/.well-known/did.json` requires a
 * UCAN delegation as `Authorization: Bearer <serialized>` (+ `X-Auth-Type:
 * ucan`). Delegations are minted in `@utils/ucanDelegation`. The worker verifies
 * each delegation by resolving the issuer DID's Ed25519 verification method on
 * chain, so the user's signing key must be registered on chain first.
 */

export const EMAIL_NOTIFIER_URL = process.env.NEXT_PUBLIC_EMAIL_NOTIFIER_URL ?? '';

export type SubscriptionStatus = 'active' | 'unsubscribed' | 'expired' | 'exhausted';

export interface EmailNotifierEvent {
  event_type: string;
  label: string;
  description: string;
  variables: string[];
  scope_variables: string[];
  default_enabled: boolean;
}

export interface Preference {
  event_type: string;
  enabled: boolean;
}

export interface Subscription {
  address: string;
  did: string;
  status: SubscriptionStatus;
  created_at: number;
  updated_at: number;
  preferences: Preference[];
}

export type SubscribeCapability =
  | 'notifier/subscribe'
  | 'notifier/read'
  | 'notifier/preferences'
  | 'notifier/unsubscribe';

export const EMAIL_NOTIFIER_RESOURCE_PREFIX = 'ixo:email-notifier:';

// Must match `RESOURCE_PREFIX.AUTH_HUB_USER` in
// `ixo-auth-hub/ixo-email-notifier/src/lib/constants.ts`. The body delegation
// rides on the notifier's forward invocation to auth-hub's `/api/user/email`.
export const AUTH_HUB_USER_RESOURCE_PREFIX = 'ixo:auth-hub:user:';
export const AUTH_USER_EMAIL_CAN = 'auth/user/email';

export function emailNotifierResource(walletAddress: string): string {
  return `${EMAIL_NOTIFIER_RESOURCE_PREFIX}${walletAddress}`;
}

export function authHubUserResource(walletAddress: string): string {
  return `${AUTH_HUB_USER_RESOURCE_PREFIX}${walletAddress}`;
}

export function buildCapabilities(can: SubscribeCapability, walletAddress: string): Capability[] {
  return [{ can, with: emailNotifierResource(walletAddress) as `${string}:${string}` }];
}

export function buildAuthUserEmailCapabilities(walletAddress: string): Capability[] {
  return [{ can: AUTH_USER_EMAIL_CAN, with: authHubUserResource(walletAddress) as `${string}:${string}` }];
}

function ensureConfigured(): string {
  if (!EMAIL_NOTIFIER_URL) {
    throw new Error('Email notifications are not configured (NEXT_PUBLIC_EMAIL_NOTIFIER_URL is unset).');
  }
  return EMAIL_NOTIFIER_URL;
}

function authHeaders(delegation: string): Record<string, string> {
  // `X-Auth-Type` matches the canonical demo client; the notifier middleware
  // doesn't read it but other tooling may.
  return { Authorization: `Bearer ${delegation}`, 'X-Auth-Type': 'ucan' };
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  return body || res.statusText;
}

export async function fetchEvents(): Promise<EmailNotifierEvent[]> {
  const base = ensureConfigured();
  const res = await fetch(`${base}/api/events`);
  if (!res.ok) throw new Error(`Fetch email notifier events failed (${res.status}): ${await errorText(res)}`);
  return (await res.json()) as EmailNotifierEvent[];
}

export async function getSubscription(delegation: string): Promise<Subscription | null> {
  // 404 = no subscription record yet. 401/403 = worker rejected the delegation
  // (audience mismatch, missing on-chain ed25519 key, etc.) — all three render
  // the subscribe form. Network/5xx errors still throw.
  const base = ensureConfigured();
  const res = await fetch(`${base}/api/subscription`, { headers: authHeaders(delegation) });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Get subscription failed (${res.status}): ${await errorText(res)}`);
  return (await res.json()) as Subscription;
}

// `POST /api/subscribe` (linked/ucan mode) takes TWO distinct UCANs:
//   - `invocation` (header `Authorization: Bearer`) — `notifier/subscribe` cap,
//     authenticates the call.
//   - `emailDelegation` (body) — `auth/user/email` cap; the notifier embeds it
//     as a proof when forwarding to auth-hub for the WorkOS email.
export async function subscribeLinked(
  invocation: string,
  emailDelegation: string,
): Promise<{ status: SubscriptionStatus; address: string }> {
  const base = ensureConfigured();
  const res = await fetch(`${base}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(invocation) },
    body: JSON.stringify({ type: 'ucan', delegation: emailDelegation }),
  });
  if (!res.ok) throw new Error(`Subscribe failed (${res.status}): ${await errorText(res)}`);
  return (await res.json()) as { status: SubscriptionStatus; address: string };
}

export async function updatePreferences(
  delegation: string,
  prefs: Preference[],
): Promise<{ ok: boolean; updated: number; preferences: Preference[] }> {
  const base = ensureConfigured();
  const res = await fetch(`${base}/api/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(delegation) },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`Update preferences failed (${res.status}): ${await errorText(res)}`);
  return (await res.json()) as { ok: boolean; updated: number; preferences: Preference[] };
}

export async function unsubscribe(delegation: string): Promise<void> {
  const base = ensureConfigured();
  const res = await fetch(`${base}/api/subscribe`, { method: 'DELETE', headers: authHeaders(delegation) });
  if (!res.ok) throw new Error(`Unsubscribe failed (${res.status}): ${await errorText(res)}`);
}
