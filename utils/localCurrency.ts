/**
 * Local-currency display, ported from ixo-zlato-offramp's module with the same
 * two rules:
 *
 *  - ESTIMATE (≈): USD × the mid-market rate from rate.exchange.ixo.earth.
 *    Used everywhere no priced transaction exists (wallet balance, earnings,
 *    off-ramp previews). Always marked ≈ — YellowCard settles at its own rate.
 *  - No country, no corridor currency, or no rate → plain USD, exactly as
 *    before.
 *
 * The user's country comes from their own data, in priority order:
 *  1. saved off-ramp profile — payout country, then nationality
 *  2. KYC credential claims — nationality (via the kycPrefill waterfall)
 * Resolution runs once per session after the Vault is ready; the result is
 * cached per address so revisits show local amounts immediately.
 */

import { loadOfframpProfile } from '@utils/offrampProfile';
import { loadKycPrefill } from '@utils/kycPrefill';

type MxClient = Parameters<typeof loadOfframpProfile>[0];

const RATE_API_URL = process.env.NEXT_PUBLIC_FIAT_RATES_URL || 'https://rate.exchange.ixo.earth';
const CACHE_PREFIX = 'yoma_local_currency:';
const RATE_TTL_MS = 60 * 60 * 1000; // mirror the worker's cache window

/** ISO 3166-1 alpha-2 → ISO 4217 for YellowCard's corridors. */
const CORRIDOR_CURRENCY: Record<string, string> = {
  BJ: 'XOF',
  BF: 'XOF',
  BW: 'BWP',
  CM: 'XAF',
  CI: 'XOF',
  CG: 'XAF',
  GA: 'XAF',
  GH: 'GHS',
  KE: 'KES',
  ML: 'XOF',
  MW: 'MWK',
  NG: 'NGN',
  RW: 'RWF',
  SN: 'XOF',
  TG: 'XOF',
  TZ: 'TZS',
  UG: 'UGX',
  ZA: 'ZAR',
  ZM: 'ZMW',
};

export function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  return CORRIDOR_CURRENCY[country.trim().toUpperCase()] ?? null;
}

export interface LocalCurrency {
  /** ISO alpha-2 the currency was derived from. */
  country: string;
  /** ISO 4217 display currency. */
  currency: string;
  /** Units of `currency` per 1 USD (mid-market). */
  rate: number;
}

interface CachedLocalCurrency extends LocalCurrency {
  fetchedAt: number;
}

let address: string | null = null;
let snapshot: LocalCurrency | null = null;
const listeners = new Set<() => void>();

const cacheKey = () => (address ? `${CACHE_PREFIX}${address}` : null);

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // one bad subscriber must not break the rest
    }
  });
}

function readCache(): CachedLocalCurrency | null {
  const key = cacheKey();
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      parsed &&
      typeof parsed.country === 'string' &&
      typeof parsed.currency === 'string' &&
      typeof parsed.rate === 'number' &&
      parsed.rate > 0
    ) {
      return parsed as CachedLocalCurrency;
    }
  } catch {
    // corrupted cache = no cache
  }
  return null;
}

function writeCache(value: CachedLocalCurrency): void {
  const key = cacheKey();
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort
  }
}

export const getLocalCurrency = (): LocalCurrency | null => snapshot;

export function subscribeLocalCurrency(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** USD → `currency` mid-market rate, or null on any failure. Never throws. */
export async function fetchUsdRate(currency: string): Promise<number | null> {
  // AbortSignal.timeout is missing from this repo's TS lib — controller form.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${RATE_API_URL}/rates/${encodeURIComponent(currency)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const rate = (body as { rate?: unknown }).rate;
    return typeof rate === 'number' && rate > 0 ? rate : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCountry(mxClient: MxClient, roomId: string): Promise<string | null> {
  // Saved off-ramp profile first: the payout country is where their money
  // actually goes. Both loaders read encrypted matrix data — best-effort.
  try {
    const profile = await loadOfframpProfile(mxClient, roomId);
    const fromProfile = currencyForCountry(profile?.country) ? profile?.country : profile?.nationality;
    if (currencyForCountry(fromProfile)) return fromProfile!.trim().toUpperCase();
  } catch {
    // fall through to KYC
  }
  try {
    const prefill = await loadKycPrefill(mxClient, roomId);
    if (currencyForCountry(prefill.country)) return prefill.country!.trim().toUpperCase();
  } catch {
    // no KYC either
  }
  return null;
}

/**
 * Resolve the session's display currency. Called once after the Vault is
 * ready (alongside deck-prefs hydration). Cache-first: a cached currency shows
 * immediately, the rate refreshes in the background when stale.
 */
export async function initLocalCurrency(mxClient: MxClient, roomId: string, forAddress: string): Promise<void> {
  address = forAddress;

  const cached = readCache();
  if (cached) {
    snapshot = { country: cached.country, currency: cached.currency, rate: cached.rate };
    notify();
    if (Date.now() - cached.fetchedAt < RATE_TTL_MS) return;
    const freshRate = await fetchUsdRate(cached.currency);
    if (freshRate) {
      snapshot = { ...snapshot, rate: freshRate };
      writeCache({ ...snapshot, fetchedAt: Date.now() });
      notify();
    }
    return;
  }

  const country = await resolveCountry(mxClient, roomId);
  const currency = currencyForCountry(country);
  if (!country || !currency) return; // stays USD

  const rate = await fetchUsdRate(currency);
  if (!rate) return;

  snapshot = { country, currency, rate };
  writeCache({ ...snapshot, fetchedAt: Date.now() });
  notify();
}

/** Logout wipe: forget every cached currency and reset the snapshot. */
export function clearLocalCurrencyStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // best-effort
    }
  }
  address = null;
  snapshot = null;
  notify();
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "K 37.75" / "R 36.20" / "CFA 1,150" — Intl picks symbol + decimals. */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** A USD amount in the local currency (no ≈ prefix), or null without one. */
export function localAmount(usd: number, local: LocalCurrency | null = snapshot): string | null {
  if (!local) return null;
  return formatCurrency(usd * local.rate, local.currency);
}

/** The ≈-marked local estimate for a USD amount, or null without a currency. */
export function localEstimate(usd: number, local: LocalCurrency | null = snapshot): string | null {
  const amount = localAmount(usd, local);
  return amount ? `≈ ${amount}` : null;
}
