import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { LEGACY_USDC_DENOMS } from '@constants/usdc';
import { IXO_CHAIN_ID } from '@constants/yellowcard';
import { useAuth } from '@hooks/useAuth';
import { getStatus as getSkipStatus, trackTx } from 'lib/skip/skipBridge';
import {
  UPGRADE_NOT_AVAILABLE,
  UsdcUpgradeError,
  buildUpgradeMsg,
  quoteUpgradeRoute,
  upgradeAddressList,
} from 'lib/skip/usdcUpgradeRoute';
import {
  type KeyValueStore,
  type PendingUpgrade,
  type UpgradeView,
  UPGRADE_FAILED_TITLE,
  UPGRADE_NOT_THROUGH,
  UPGRADE_NOT_THROUGH_TITLE,
  UPGRADE_NOT_FOUND_AFTER_MS,
  UPGRADE_POLL_BUDGET_MS,
  UPGRADE_REGISTER_BUDGET_MS,
  UPGRADE_SIGN_LABEL,
  UPGRADE_SLOW_AFTER_MS,
  attentionReleased,
  broadcastFailureStage,
  classifyRegisterError,
  clearPendingUpgrade,
  inFlightMicro,
  loadPendingUpgrade,
  nextPollDelayMs,
  resolveUpgradeStatus,
  savePendingUpgrade,
  upgradeErrorMessage,
  upgradeErrorRetryable,
  upgradeOffer,
} from 'lib/usdcUpgrade/upgradeState';
import {
  type UsdcUpgradeStatus,
  RampApiError,
  fetchOfframpConfig,
  getUsdcUpgrade,
  isUsdcUpgradeStatus,
  registerUsdcUpgrade,
} from 'lib/yellowcard/offrampClient';
import { lookupIxoTx } from '@utils/ixoTxLookup';
import { mintOfframpBearer } from '@utils/ucanYellowcard';
import { type UsdcBalances, getWalletBalances } from '@utils/usdcBalance';

/** Browser storage, or null where it is unavailable (SSR, blocked site data). */
function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ONE shared tracker per app: the running upgrade, its status, and one poller,
// whichever screens (wallet, withdraw) show it.
// ---------------------------------------------------------------------------

/** How a running upgrade ended, shown until the card is closed. */
type Outcome =
  | { kind: 'completed' }
  | { kind: 'returned'; amountMicro: bigint; returnedMicro: bigint | null }
  | { kind: 'unconfirmed' }
  | { kind: 'not_through' };

interface Snapshot {
  address: string | null;
  pending: PendingUpgrade | null;
  /** Last known status while `pending`. */
  status: UsdcUpgradeStatus;
  /** The worker could not confirm it this visit (record kept; the next visit tries again). */
  unconfirmed: boolean;
  outcome: Outcome | null;
  /** The card was closed for this visit (needs-attention / couldn't-confirm). */
  hidden: boolean;
}

let snapshot: Snapshot = {
  address: null,
  pending: null,
  status: 'in_progress',
  unconfirmed: false,
  outcome: null,
  hidden: false,
};
const listeners = new Set<() => void>();
const settledListeners = new Set<() => void>();
let mintBearerRef: (() => Promise<string>) | null = null;

function update(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** Re-read the balances on every screen that shows them. */
function notifySettled() {
  settledListeners.forEach((l) => l());
}

/** End tracking: drop the record (memory + storage) and show how it ended. */
function settle(outcome: Outcome) {
  const rec = snapshot.pending;
  if (rec) clearPendingUpgrade(browserStore(), rec.address);
  stopPoller();
  update({ pending: null, unconfirmed: false, outcome, hidden: false });
  notifySettled();
}

/** Point the tracker at an account: its stored record (if any) becomes the running upgrade. */
function selectAccount(address: string | null) {
  if (snapshot.address === address) return;
  stopPoller();
  const pending = address ? loadPendingUpgrade(browserStore(), address) : null;
  update({ address, pending, status: 'in_progress', unconfirmed: false, outcome: null, hidden: false });
}

function adoptPending(record: PendingUpgrade) {
  savePendingUpgrade(browserStore(), record);
  update({ pending: record, status: 'in_progress', unconfirmed: false, outcome: null, hidden: false });
  ensurePoller();
}

interface Poller {
  txHash: string;
  /** When polling started in this visit (the 30-minute budget). */
  visitStartedAt: number;
  /** First failed registration in this visit (the 15-minute budget). */
  registerSince: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
  running: boolean;
  /** A tick is due but the tab is hidden: run it when the tab is shown again. */
  waitingForVisible: boolean;
}

let poller: Poller | null = null;

function stopPoller() {
  if (!poller) return;
  poller.stopped = true;
  if (poller.timer) clearTimeout(poller.timer);
  poller = null;
}

const tabHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function schedule(p: Poller, delayMs: number) {
  if (p.stopped) return;
  p.timer = setTimeout(() => {
    p.timer = null;
    if (tabHidden()) {
      p.waitingForVisible = true;
      return;
    }
    void tick(p);
  }, delayMs);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const p = poller;
    if (p && !p.stopped && p.waitingForVisible && !tabHidden()) {
      p.waitingForVisible = false;
      void tick(p);
    }
  });
}

/** Start polling the running upgrade (no-op while a poller for it runs). */
function ensurePoller() {
  const rec = snapshot.pending;
  if (!rec || snapshot.unconfirmed) return;
  if (poller && poller.txHash === rec.txHash && !poller.stopped) return;
  stopPoller();
  const p: Poller = {
    txHash: rec.txHash,
    visitStartedAt: Date.now(),
    registerSince: null,
    timer: null,
    stopped: false,
    running: false,
    waitingForVisible: false,
  };
  poller = p;
  if (tabHidden()) p.waitingForVisible = true;
  else void tick(p);
}

async function tick(p: Poller) {
  if (p.stopped || p.running) return;
  p.running = true;
  try {
    await pollOnce(p);
  } catch (err) {
    console.warn('[usdc-upgrade] poll failed', err);
    if (!p.stopped && snapshot.pending) schedule(p, nextPollDelayMs(Date.now() - snapshot.pending.startedAt));
  } finally {
    p.running = false;
  }
}

async function pollOnce(p: Poller) {
  let rec = snapshot.pending;
  if (!rec || rec.txHash !== p.txHash) return;
  const now = Date.now();
  const mint = mintBearerRef;
  let retryAfterMs = 0;

  // 1. Register with the worker (so it can follow the route and return the USDC if needed).
  if (!rec.registered) {
    try {
      if (!mint) throw new Error('Not signed in');
      await registerUsdcUpgrade({ tx_hash: rec.txHash, amount_micro: rec.amountMicro }, await mint());
      rec = { ...rec, registered: true, stage: 'broadcast' };
      savePendingUpgrade(browserStore(), rec);
      update({ pending: rec });
      p.registerSince = null;
    } catch (err) {
      const failure = classifyRegisterError(err);
      if (failure.kind === 'tx_failed') {
        console.warn('[usdc-upgrade] the transfer failed on chain', err);
        settle({ kind: 'not_through' });
        return;
      }
      if (failure.kind === 'refused') {
        console.warn('[usdc-upgrade] the worker refused the upgrade', err);
        settle({ kind: 'unconfirmed' });
        return;
      }
      if (p.registerSince == null) p.registerSince = now;
      retryAfterMs = failure.retryAfterMs ?? 0;
      console.warn('[usdc-upgrade] registration not confirmed yet', err);
    }
  }

  // 2. The worker's status (authoritative: it also knows about automatic returns).
  let worker: UsdcUpgradeStatus | null = null;
  let returnedMicro: bigint | null = null;
  if (rec.registered) {
    try {
      if (!mint) throw new Error('Not signed in');
      const row = await getUsdcUpgrade(rec.txHash, await mint());
      worker = isUsdcUpgradeStatus(row?.status) ? row.status : null;
      returnedMicro =
        typeof row?.returned_amount_micro === 'string' && /^\d+$/.test(row.returned_amount_micro)
          ? BigInt(row.returned_amount_micro)
          : null;
    } catch (err) {
      // 404: the worker does not know this tx (any more) — register it again next time.
      if (err instanceof RampApiError && err.status === 404) {
        rec = { ...rec, registered: false };
        savePendingUpgrade(browserStore(), rec);
        update({ pending: rec });
      }
      console.warn('[usdc-upgrade] worker status unavailable', err);
    }
  }

  // 3. No worker answer: Skip's own status, and — while unregistered — whether it ever went out.
  let skipState: string | null = null;
  if (!worker) {
    skipState = await getSkipStatus(IXO_CHAIN_ID, rec.txHash)
      .then((s) => s.state)
      .catch(() => null);
    if (!rec.registered && !/COMPLETED_SUCCESS/i.test(skipState ?? '')) {
      const onChain = await lookupIxoTx(rec.txHash);
      if (onChain?.found && onChain.code !== 0) {
        settle({ kind: 'not_through' });
        return;
      }
      if (onChain && !onChain.found && now - rec.startedAt > UPGRADE_NOT_FOUND_AFTER_MS) {
        settle({ kind: 'not_through' });
        return;
      }
    }
  }
  if (p.stopped) return;

  const next = resolveUpgradeStatus({ worker, skipState });
  if (next === 'completed') {
    settle({ kind: 'completed' });
    return;
  }
  if (next === 'returned') {
    settle({ kind: 'returned', amountMicro: BigInt(rec.amountMicro), returnedMicro });
    return;
  }
  update({ status: next });

  // Not confirmed by the worker for 15 minutes: say so, keep the record, try again next visit.
  if (!rec.registered && p.registerSince != null && Date.now() - p.registerSince >= UPGRADE_REGISTER_BUDGET_MS) {
    stopPoller();
    update({ unconfirmed: true });
    return;
  }
  // Stop after 30 minutes in one visit; the record stays and the next visit resumes.
  if (Date.now() - p.visitStartedAt >= UPGRADE_POLL_BUDGET_MS) {
    stopPoller();
    return;
  }
  schedule(p, Math.max(nextPollDelayMs(Date.now() - rec.startedAt), retryAfterMs));
}

// One upgrade at a time per tab, across every screen that mounts this hook (the
// stored pending record covers reloads and other tabs).
let upgradeStarting = false;

export interface UsdcUpgrade {
  /** False on networks with no legacy USDC (testnet/devnet): render nothing. */
  enabled: boolean;
  /** What the upgrade card shows; null = nothing to show. */
  view: UpgradeView | null;
  /** The card was closed for this visit (needs attention / couldn't confirm): the calm
   *  notice under the balance hides it; the withdraw step still shows it. */
  hidden: boolean;
  /** Legacy USDC that can be upgraded right now (0 = none / not offered / one already running). */
  offerMicro: bigint;
  /** The amount the card talks about: the running upgrade's, the explainer's, or the offer's. */
  amountMicro: bigint;
  /** `returned` view: what came back (null = the worker did not say). */
  returnedMicro: bigint | null;
  /** A running upgrade (pending record) exists — including one the worker could not confirm. */
  running: boolean;
  /** The part of a running upgrade that is in neither balance right now — counted in the one USDC total. */
  inTransitMicro: bigint;
  /** Show the explainer ("Upgrade your USDC") — step 0. */
  open: () => void;
  /** Leave the explainer without starting. */
  cancel: () => void;
  /** Re-quote, check, sign once, broadcast, register. Guarded against double taps. */
  start: () => Promise<void>;
  /** Close a finished, failed, needs-attention or couldn't-confirm card. */
  dismiss: () => void;
}

/**
 * The one-tap USDC upgrade: the WHOLE legacy (Noble) USDC balance → the
 * withdrawable (Injective) USDC on ixo, via Skip Go, with ONE signature through
 * the app's session-key signer (`useAuth().onSign` — the same path, gas and
 * feegrant lookup as the off-ramp bridge).
 *
 *  1. explainer → `start()`: fresh balances + `GET /offramp/config`, the Skip
 *     route re-quoted right before signing, the message checked
 *     (lib/skip/usdcUpgradeRoute); a changed amount goes back to the explainer;
 *  2. sign; the tx hash is saved locally BEFORE broadcast (with the balances at
 *     that moment), so a reload or a lost connection can never lose it;
 *  3. broadcast: refused or failed on chain → "didn't go through" (nothing
 *     moved); timed out → it may still land, so it is tracked like any other;
 *  4. ONE shared poller per app: `POST /usdc-upgrade` (503/429 retried for up to
 *     15 min, then "couldn't confirm" with the record kept; `tx_failed` →
 *     "didn't go through"; other refusals → "couldn't confirm"), then `GET
 *     /usdc-upgrade/:txHash` (Skip's status when the worker has no answer) —
 *     every 15 s for 3 min, 30 s until 10 min, then every minute, paused while
 *     the tab is hidden, stopping after 30 min (the next visit resumes).
 *     `onSettled` fires on every screen when it ends, so balances are re-read.
 *
 * `balances` is the screen's latest USDC read (null while loading / unknown):
 * it decides the offer and the amount still on its way (`inTransitMicro`).
 */
export default function useUsdcUpgrade(params: { balances: UsdcBalances | null; onSettled?: () => void }): UsdcUpgrade {
  const { address, did, onSign } = useAuth();
  // The worker requires the upgrade to be signed by the account its UCAN is rooted in.
  const accountMatches = !!address && !!did && did === `did:ixo:${address}`;
  const enabled = LEGACY_USDC_DENOMS.length > 0;

  // Legacy denoms the worker offers to upgrade (`GET /offramp/config`; empty = no offer).
  const [upgradeable, setUpgradeable] = useState<readonly string[]>([]);
  // Local UI state before anything is signed (explainer, preparing, failed to start).
  const [localView, setLocalView] = useState<UpgradeView | null>(null);
  // The amount the explainer showed — compared with the fresh balance at signing.
  const [confirmMicro, setConfirmMicro] = useState<bigint | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);
  const shared = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (enabled && address && did && !accountMatches) {
      console.warn('[usdc-upgrade] not offered: the signed-in DID is not did:ixo:<address>', { did, address });
    }
  }, [enabled, address, did, accountMatches]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchOfframpConfig()
      .then((c) => {
        if (!cancelled) setUpgradeable(c.legacy_usdc_denoms);
      })
      .catch(() => {
        if (!cancelled) setUpgradeable([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // The shared tracker follows the signed-in account and resumes its stored upgrade.
  useEffect(() => {
    if (!enabled) return;
    selectAccount(address ?? null);
  }, [enabled, address]);

  const mintBearer = useCallback(async () => {
    if (!did) throw new Error('Not signed in');
    return mintOfframpBearer(did);
  }, [did]);
  useEffect(() => {
    mintBearerRef = mintBearer;
  }, [mintBearer]);

  // Every screen showing balances re-reads them when an upgrade ends.
  const onSettledRef = useRef(params.onSettled);
  onSettledRef.current = params.onSettled;
  useEffect(() => {
    const listener = () => onSettledRef.current?.();
    settledListeners.add(listener);
    return () => {
      settledListeners.delete(listener);
    };
  }, []);

  // A screen that shows the upgrade (re)starts the shared poller — a new visit after it stopped.
  const pendingHash = shared.address === address ? shared.pending?.txHash ?? null : null;
  useEffect(() => {
    if (!enabled || !pendingHash || !mintBearerRef) return;
    ensurePoller();
  }, [enabled, pendingHash, mintBearer]);

  const pending = pendingHash ? shared.pending : null;

  const offer = useMemo(
    () => (enabled && accountMatches ? upgradeOffer(params.balances?.legacy ?? null, upgradeable) : null),
    [enabled, accountMatches, params.balances, upgradeable],
  );

  const start = useCallback(async () => {
    if (!enabled || !address || !did) return;
    if (!accountMatches) {
      setLocalView({ kind: 'failed', title: UPGRADE_FAILED_TITLE, message: UPGRADE_NOT_AVAILABLE, retry: false });
      return;
    }
    if (busyRef.current || upgradeStarting) return;
    const existing = loadPendingUpgrade(browserStore(), address);
    const released =
      !!existing &&
      snapshot.pending?.txHash === existing.txHash &&
      attentionReleased({
        status: snapshot.status,
        unconfirmed: snapshot.unconfirmed,
        startedAt: existing.startedAt,
        now: Date.now(),
      });
    if (existing && !released) {
      // Already running (another screen or tab): show it rather than start a second one.
      setLocalView(null);
      adoptPending(existing);
      return;
    }
    busyRef.current = true;
    upgradeStarting = true;
    setLocalView({ kind: 'preparing' });
    // Set by `onSigned` (inside the signer), before broadcast.
    const signed: { record: PendingUpgrade | null } = { record: null };
    try {
      // Fresh numbers right before signing: the whole legacy balance, the worker's addresses.
      const [config, balances] = await Promise.all([fetchOfframpConfig({ fresh: true }), getWalletBalances(address)]);
      // A failed read is unknown, not "nothing to upgrade".
      if (!balances.complete) throw new Error('Could not read the wallet balances');
      const fresh = upgradeOffer(balances.usdc.legacy, config.legacy_usdc_denoms);
      if (!fresh) {
        setLocalView(null);
        onSettledRef.current?.();
        return;
      }
      // The amount moved must be the amount the user agreed to: if it changed, ask again.
      if (confirmMicro == null || fresh.micro !== confirmMicro) {
        setConfirmMicro(fresh.micro);
        setLocalView({ kind: 'confirm' });
        return;
      }
      const amountMicro = fresh.micro.toString();
      const route = await quoteUpgradeRoute(fresh.denom, amountMicro);
      const addressList = upgradeAddressList(route.requiredChainAddresses, address, config.skip_chain_addresses);
      const msg = await buildUpgradeMsg(route, addressList, address, config.skip_chain_addresses);

      const startOf = {
        legacyAtStartMicro: balances.usdc.legacyMicro.toString(),
        upgradedAtStartMicro: balances.usdc.usdcMicro.toString(),
      };
      try {
        await onSign([msg], UPGRADE_SIGN_LABEL, {
          memo: UPGRADE_SIGN_LABEL,
          // Remembered BEFORE broadcast: from here on the transfer can never go untracked.
          onSigned: (txHash) => {
            signed.record = {
              v: 2,
              address,
              txHash,
              amountMicro,
              startedAt: Date.now(),
              stage: 'signed',
              registered: false,
              ...startOf,
            };
            savePendingUpgrade(browserStore(), signed.record);
          },
        });
      } catch (err) {
        const stage = broadcastFailureStage(err);
        if (stage !== 'maybe_sent' || !signed.record) {
          if (signed.record) clearPendingUpgrade(browserStore(), address);
          signed.record = null;
          if (stage === 'failed_on_chain') {
            console.warn('[usdc-upgrade] the transfer failed on chain', err);
            setLocalView({
              kind: 'failed',
              title: UPGRADE_NOT_THROUGH_TITLE,
              message: UPGRADE_NOT_THROUGH,
              retry: true,
            });
            onSettledRef.current?.();
            return;
          }
          throw err;
        }
        // Accepted but not seen in a block yet: it may well land — track it like any other.
        console.warn('[usdc-upgrade] broadcast not confirmed yet; tracking it', err);
      }
      if (!signed.record) throw new Error('Signed without a transaction hash');
      const sent: PendingUpgrade = { ...signed.record, stage: 'broadcast' };
      void trackTx(IXO_CHAIN_ID, sent.txHash).catch(() => undefined);
      setLocalView(null);
      setConfirmMicro(null);
      adoptPending(sent); // the shared poller registers it with the worker straight away
    } catch (err) {
      console.warn('[usdc-upgrade] could not start', err instanceof UsdcUpgradeError ? err.detail : err);
      setLocalView({
        kind: 'failed',
        title: UPGRADE_FAILED_TITLE,
        message: upgradeErrorMessage(err),
        retry: upgradeErrorRetryable(err),
      });
    } finally {
      busyRef.current = false;
      upgradeStarting = false;
    }
  }, [enabled, address, did, accountMatches, onSign, confirmMicro]);

  const open = useCallback(() => {
    update({ outcome: null });
    setConfirmMicro(offer?.micro ?? null);
    setLocalView({ kind: 'confirm' });
  }, [offer]);
  const cancel = useCallback(() => {
    setConfirmMicro(null);
    setLocalView(null);
  }, []);
  const dismiss = useCallback(() => {
    setLocalView(null);
    if (snapshot.outcome) update({ outcome: null });
    // A running upgrade that needs the team / could not be confirmed: hide it for this visit.
    else if (snapshot.pending) update({ hidden: true });
  }, []);

  // Tick the clock while running so "taking a little longer" can appear without a poll result.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [pending]);

  let view: UpgradeView | null = null;
  let amountMicro = offer?.micro ?? BigInt(0);
  let returnedMicro: bigint | null = null;
  // Fresh legacy USDC next to an upgrade that has been with the team for 24 h: offer it again.
  const releasedForNew =
    !!pending &&
    !!offer &&
    attentionReleased({ status: shared.status, unconfirmed: shared.unconfirmed, startedAt: pending.startedAt, now });
  if (pending && !releasedForNew) {
    amountMicro = BigInt(pending.amountMicro);
    view = shared.unconfirmed
      ? { kind: 'unconfirmed' }
      : shared.status === 'returning'
      ? { kind: 'returning' }
      : shared.status === 'needs_attention'
      ? { kind: 'needs_attention' }
      : { kind: 'in_progress', slow: now - pending.startedAt > UPGRADE_SLOW_AFTER_MS };
  } else if (localView) {
    view = localView;
    if (localView.kind === 'confirm' && confirmMicro != null) amountMicro = confirmMicro;
  } else if (shared.outcome && shared.address === address) {
    const o = shared.outcome;
    if (o.kind === 'returned') {
      amountMicro = o.amountMicro;
      returnedMicro = o.returnedMicro;
    }
    view =
      o.kind === 'not_through'
        ? { kind: 'failed', title: UPGRADE_NOT_THROUGH_TITLE, message: UPGRADE_NOT_THROUGH, retry: !!offer }
        : o.kind === 'returned'
        ? { kind: 'returned', returnedMicro: o.returnedMicro }
        : o;
  } else if (offer) {
    view = { kind: 'offer' };
  }

  // The amount still on its way: in neither balance right now (never counted twice).
  const balances = params.balances;
  const inTransitMicro =
    pending && balances
      ? inFlightMicro({
          amountMicro: BigInt(pending.amountMicro),
          legacyAtStartMicro: BigInt(pending.legacyAtStartMicro),
          upgradedAtStartMicro: BigInt(pending.upgradedAtStartMicro),
          legacyNowMicro: balances.legacyMicro,
          upgradedNowMicro: balances.usdcMicro,
        })
      : BigInt(0);

  return {
    enabled,
    view,
    hidden: !!pending && shared.hidden,
    offerMicro: (!pending || releasedForNew) && offer ? offer.micro : BigInt(0),
    amountMicro,
    returnedMicro,
    running: !!pending,
    inTransitMicro,
    open,
    cancel,
    start,
    dismiss,
  };
}
