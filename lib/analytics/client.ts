/**
 * PostHog product analytics — ported from the portal (impacts-x-web
 * `lib/analytics/client.ts`) so both apps report into the shared project the
 * same way:
 *
 *  - posthog-js is lazy-loaded and never ships in first-load JS;
 *  - nothing runs off-mainnet unless NEXT_PUBLIC_POSTHOG_FORCE_ENABLE=true;
 *  - nothing runs before the user accepts the consent banner;
 *  - distinct_id is the user's DID; identity traits use the portal's keys;
 *  - every event carries the signed-in user's context read at capture time;
 *  - autocapture and session recording are off (JAMBO holds key material in
 *    obfuscated localStorage — never let the SDK read the DOM or storage).
 */
import type { PostHog } from 'posthog-js';

import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';
import { store } from '@store/index';

import { hasAnalyticsConsent, setAnalyticsConsentValue } from './consent';
import type { TrackingEvent, TrackingProps, UserTraits } from './events';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_FORCE_ENABLE = process.env.NEXT_PUBLIC_POSTHOG_FORCE_ENABLE === 'true';
// Same-origin ingest proxy: vercel.json rewrites /ingest/* to PostHog so
// tracking blockers don't see a third-party host (the app deploys on Vercel).
// `next dev` has no such proxy, so local debugging points
// NEXT_PUBLIC_POSTHOG_HOST at PostHog directly.
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest';

/**
 * Super properties stamped on every event. The PostHog project is shared with
 * the portal and every brand it serves, so dashboards split traffic by
 * `app` / `brand` rather than by hostname.
 */
export const ANALYTICS_SUPER_PROPERTIES = {
  app: 'jambo',
  brand: 'yoma',
  environment: DefaultChainNetwork,
} as const;

const MATRIX_HOMESERVER_DOMAIN: string | undefined = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL;
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
})();

let initialized = false;

// Calls arriving while the posthog-js chunk is still loading are queued and
// flushed on init; calls arriving before init was ever started are dropped.
let posthogClient: PostHog | null = null;
const pendingCalls: Array<(client: PostHog) => void> = [];

function withPosthog(fn: (client: PostHog) => void): void {
  if (posthogClient) {
    fn(posthogClient);
    return;
  }
  if (initialized) {
    pendingCalls.push(fn);
  }
}

/**
 * Reads the signed-in user from Redux at call time so every event carries
 * identity properties — including for sessions revived from storage where no
 * fresh identify() has happened yet in this page load.
 *
 * Name resolution mirrors the portal: display name → Matrix profile display
 * name → Matrix user-id localpart.
 */
function readUserEventContext(): Record<string, unknown> {
  try {
    const state = store.getState();
    const account = state.account;
    if (!account?.did) return {};

    const matrixLocalpart = account.matrixUserId ? account.matrixUserId.replace(/^@/, '').split(':')[0] : undefined;

    return {
      userName: account.displayName || state.matrixProfile?.displayName || matrixLocalpart,
      userDid: account.did,
      userAddress: account.address,
      userMatrixId: account.matrixUserId || undefined,
    };
  } catch {
    return {};
  }
}

export function isAnalyticsEnvEnabled(): boolean {
  if (!POSTHOG_KEY) return false;
  return DefaultChainNetwork === CHAIN_NETWORK_TYPE.MAINNET || POSTHOG_FORCE_ENABLE;
}

export function shouldEnablePostHog(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isAnalyticsEnvEnabled()) return false;
  return hasAnalyticsConsent();
}

export function initAnalytics(): void {
  if (!shouldEnablePostHog() || initialized) return;
  initialized = true;

  void import('posthog-js').then(({ default: posthog }) => {
    // Consent may have been withdrawn while the chunk was loading.
    if (!shouldEnablePostHog()) {
      pendingCalls.splice(0);
      initialized = false;
      return;
    }
    const client = posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      ui_host: 'https://us.posthog.com',
      defaults: '2026-01-30',
      person_profiles: 'always',
      disable_session_recording: true,
      autocapture: false,
      capture_pageview: 'history_change',
      capture_pageleave: true,
    });

    client.register(ANALYTICS_SUPER_PROPERTIES);

    posthogClient = client;
    pendingCalls.splice(0).forEach((fn) => fn(client));
  });
}

export function trackRaw(event: string, props?: Record<string, unknown>): void {
  if (!shouldEnablePostHog()) return;
  const eventProps = { ...readUserEventContext(), ...(props ?? {}) };
  withPosthog((client) => client.capture(event, eventProps));
}

export function track<E extends TrackingEvent>(
  event: E,
  ...args: TrackingProps<E> extends undefined ? [] : [props: TrackingProps<E>]
): void {
  trackRaw(event, args[0] as Record<string, unknown> | undefined);
}

/** Builds the identify() traits from the auth session. Same keys as the portal. */
export function buildUserTraits(input: {
  did: string;
  address?: string | null;
  displayName?: string | null;
  matrixUserId?: string | null;
}): UserTraits {
  return {
    name: input.displayName || undefined,
    did: input.did,
    address: input.address || undefined,
    matrixUserId: input.matrixUserId || undefined,
    matrixHomeserver: MATRIX_HOMESERVER_DOMAIN,
  };
}

export function identify(distinctId: string, traits?: UserTraits): void {
  if (!shouldEnablePostHog()) return;
  withPosthog((client) => client.identify(distinctId, traits as Record<string, unknown> | undefined));
}

/** Forget the identified user (logout). Safe to call before init. */
export function resetAnalytics(): void {
  if (!initialized || typeof window === 'undefined') return;
  try {
    posthogClient?.reset();
  } catch {
    // posthog may not be fully ready — ignore
  }
}

export function grantAnalyticsConsent(): void {
  setAnalyticsConsentValue('granted');
  if (initialized && typeof window !== 'undefined') {
    try {
      posthogClient?.opt_in_capturing?.();
    } catch {
      // posthog may not be fully ready; ignore
    }
  }
  initAnalytics();
}

export function revokeAnalyticsConsent(): void {
  pendingCalls.splice(0);
  if (initialized && typeof window !== 'undefined') {
    try {
      posthogClient?.reset();
      posthogClient?.opt_out_capturing?.();
    } catch {
      // posthog may not be fully ready — ignore
    }
  }
  setAnalyticsConsentValue('denied');
}
