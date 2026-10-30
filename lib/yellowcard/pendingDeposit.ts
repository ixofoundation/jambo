import { RampApiError } from 'lib/yellowcard/offrampClient';

/**
 * The off-ramp transfers this browser signed but the worker has not recorded yet
 * (`POST /offramp/{id}/deposit`). Pure parts — hooks/useOfframp drives them;
 * unit-tested in pendingDeposit.test.ts.
 *
 * The hash is saved BEFORE broadcast (lib/authHub/signAndBroadcast `onSigned`),
 * so a reload, a closed tab, a broadcast time-out or a failed deposit call can
 * never leave a sent transfer unknown: the record is re-sent to the worker until
 * it is recorded, and while it exists the withdrawal is never offered for a
 * second send ("Complete").
 */

export interface PendingDeposit {
  v: 1;
  offrampId: string;
  /** sha256 of the signed tx bytes, upper-case hex. */
  txHash: string;
  /** ms since epoch, when it was signed. */
  signedAt: number;
  /** `pending`: keep telling the worker; `unconfirmed`: the worker refused it — support can help. */
  state: 'pending' | 'unconfirmed';
}

export type PendingDeposits = Record<string, PendingDeposit>;

/** The subset of `Storage` used here (so tests can pass a Map-backed fake). */
export interface DepositStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function pendingDepositsKey(address: string): string {
  return `jambo.offramp.pendingDeposit.${address}`;
}

function parseEntry(id: string, v: any): PendingDeposit | null {
  if (
    v?.v !== 1 ||
    v.offrampId !== id ||
    typeof v.txHash !== 'string' ||
    !/^[0-9A-Fa-f]{64}$/.test(v.txHash) ||
    typeof v.signedAt !== 'number' ||
    !Number.isFinite(v.signedAt) ||
    (v.state !== 'pending' && v.state !== 'unconfirmed')
  ) {
    return null;
  }
  return { v: 1, offrampId: id, txHash: v.txHash.toUpperCase(), signedAt: v.signedAt, state: v.state };
}

/** Malformed entries are dropped; storage problems read as "none". */
export function loadPendingDeposits(store: DepositStore | null, address: string): PendingDeposits {
  if (!store || !address) return {};
  try {
    const raw = store.getItem(pendingDepositsKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: PendingDeposits = {};
    if (parsed && typeof parsed === 'object') {
      for (const [id, v] of Object.entries(parsed)) {
        const entry = parseEntry(id, v);
        if (entry) out[id] = entry;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePendingDeposits(store: DepositStore | null, address: string, deposits: PendingDeposits): void {
  if (!store || !address) return;
  try {
    if (Object.keys(deposits).length === 0) store.removeItem(pendingDepositsKey(address));
    else store.setItem(pendingDepositsKey(address), JSON.stringify(deposits));
  } catch {
    /* the in-memory copy still drives this page */
  }
}

export function withDeposit(deposits: PendingDeposits, entry: PendingDeposit): PendingDeposits {
  return { ...deposits, [entry.offrampId]: entry };
}

export function withoutDeposit(deposits: PendingDeposits, offrampId: string): PendingDeposits {
  if (!(offrampId in deposits)) return deposits;
  const next = { ...deposits };
  delete next[offrampId];
  return next;
}

/**
 * What a failed `POST /offramp/{id}/deposit` means (yellowcard-worker, fix round 30 Oct 2026):
 *  - `retry`: 503 `tx_pending` / `verification_unavailable`, 429, 5xx, network / time-out;
 *  - `tx_failed`: 422 `tx_failed` — the transfer failed on chain, nothing moved;
 *  - `already_recorded`: 409 `deposit_already_recorded` — another transfer is recorded;
 *  - `refused`: any other 400 / 403 / 409 / 422 (`deposit_mismatch`, `not_your_transaction`, …) —
 *    permanent; the transfer may have moved, so the withdrawal must not be re-sent.
 */
export type DepositFailure =
  | { kind: 'retry'; retryAfterMs?: number }
  | { kind: 'tx_failed' }
  | { kind: 'already_recorded' }
  | { kind: 'refused' };

export function classifyDepositError(err: unknown): DepositFailure {
  if (!(err instanceof RampApiError)) return { kind: 'retry' };
  if (err.status === 422 && err.code === 'tx_failed') return { kind: 'tx_failed' };
  if (err.status === 409 && err.code === 'deposit_already_recorded') return { kind: 'already_recorded' };
  if (err.status === 400 || err.status === 403 || err.status === 409 || err.status === 422) return { kind: 'refused' };
  return { kind: 'retry', retryAfterMs: err.retryAfterSec != null ? err.retryAfterSec * 1000 : undefined };
}

/** Re-sent at most this often per record (the worker answers 503 `tx_pending` until indexed). */
export const DEPOSIT_RETRY_EVERY_MS = 15_000;
/** Told to the worker for this long per visit, then shown as "couldn't confirm" (record kept). */
export const DEPOSIT_RETRY_BUDGET_MS = 15 * 60 * 1000;
/** A signed transfer the chain still does not know after this long never went out. */
export const DEPOSIT_NOT_FOUND_AFTER_MS = 10 * 60 * 1000;
