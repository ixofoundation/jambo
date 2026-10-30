import { useCallback, useEffect, useRef, useState } from 'react';

import { INJECTIVE_USDC_DENOM } from '@constants/usdc';
import { OFFRAMP_DESTINATION } from '@constants/yellowcard';
import { useAuth } from '@hooks/useAuth';
import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import {
  completeChainAddresses,
  resolvePreSellChainAddresses,
  routeNeedsRecoveryAddresses,
} from 'lib/skip/chainAddresses';
import { type BridgeRoute, buildBridgeTx, getBridgeRoute, trackTx } from 'lib/skip/skipBridge';
import {
  type DepositStore,
  type PendingDeposits,
  DEPOSIT_NOT_FOUND_AFTER_MS,
  DEPOSIT_RETRY_BUDGET_MS,
  DEPOSIT_RETRY_EVERY_MS,
  classifyDepositError,
  loadPendingDeposits,
  savePendingDeposits,
  withDeposit,
  withoutDeposit,
} from 'lib/yellowcard/pendingDeposit';
import { displayToBase } from '@utils/denomAmount';
import { lookupIxoTx } from '@utils/ixoTxLookup';
import {
  type CreateResult,
  type OfframpCustomer,
  type OfframpDestination,
  type OfframpTransaction,
  type QuoteResult,
  type RampApiErrorDetails,
  createOfframp,
  fetchOfframpConfig,
  fetchPaymentRecordPdf,
  getOfframp,
  listOfframps,
  notifyDeposit,
  quoteOfframp,
  rampApiErrorDetails,
} from 'lib/yellowcard/offrampClient';
import {
  OFFRAMP_DEPOSIT_RECORDED_ELSEWHERE,
  OFFRAMP_DEPOSIT_UNCONFIRMED,
  OFFRAMP_NOT_THROUGH,
  offrampErrorMessage,
} from 'lib/yellowcard/offrampDecision';
import { mintOfframpBearer } from '@utils/ucanYellowcard';

const USDC_DECIMALS = 6;

/** Whole USDC → base units, exactly (decimal string math, no float multiply). The worker
 *  compares the chain amount with the stored send amount to the micro. */
function toMicro(amount: number): string {
  const exact = displayToBase(String(amount), USDC_DECIMALS);
  if (exact == null) throw new Error(`Unsupported withdrawal amount ${amount}`);
  return exact;
}

/** Browser storage, or null where it is unavailable (SSR, blocked site data). */
function browserStore(): DepositStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The ONE USDC every withdrawal bridges. Legacy USDC is upgraded first
 *  (hooks/useUsdcUpgrade), never withdrawn. */
const SOURCE_DENOM = INJECTIVE_USDC_DENOM;

/** A priced Skip route plus every address it needs except Base's (the YellowCard
 *  deposit address, known only once the sell exists). See lib/skip/chainAddresses:
 *  ixo + `1776` (the worker's refund wallet, from `GET /offramp/config`) + Base.
 *  Anything else throws. */
interface PreparedRoute {
  route: BridgeRoute;
  preSell: Record<string, string>;
}

/** In-flight stage of a withdrawal, for UI feedback. */
export type OfframpStage = 'idle' | 'authorizing' | 'creating' | 'bridging' | 'notifying' | 'submitted' | 'error';

export interface WithdrawParams {
  /** Whole USDC the user SENDS from ixo (bridged via Skip). The YC sell is
   *  created for the amount that ACTUALLY arrives, recomputed at withdraw time
   *  (the user may have waited after quoting). */
  amountUsdc: number;
  currency: string;
  /** Payout rail (bank|momo) — YC auto-routes to the best channel. */
  channelType: string;
  customer: OfframpCustomer;
  destination: OfframpDestination;
  /** The user's KYC SD-JWT presentation, when they hold one — the worker
   *  verifies it against our oracle and binds it to the caller's DID. Optional:
   *  below the worker's volume threshold no credential is needed; leave it
   *  undefined (never '') and the field is omitted from the request. */
  kycCredential?: string;
  /** TEMP (testnet): create the YC sell only — skip the Skip Go bridge + deposit
   *  notify (no USDC on testnet). The amount is used as-is (no bridge fee). */
  skipBridge?: boolean;
}

/** Preview combining BOTH legs: the Skip bridge (ixo→Base) fee and the YC
 *  quote, taken on the amount that actually ARRIVES after the bridge. */
export interface WithdrawalPreview {
  quote: QuoteResult;
  sendUsdc: number;
  bridgedUsdc: number;
  skipFeeUsd: number;
}

/**
 * YellowCard off-ramp orchestration for jambo. Uses the auth-hub session-key
 * signer (`useAuth().onSign`) for the single bridge transaction — jambo has
 * one signing path, so there's no passkey/SignX branching. Each worker call is
 * authorised with a freshly-minted UCAN invocation (no PIN prompt: the Ed25519
 * key is already in secure storage post-login).
 */
export default function useOfframp() {
  const { address, did, onSign } = useAuth();

  const [stage, setStage] = useState<OfframpStage>('idle');
  const [error, setError] = useState<string | null>(null);
  // Machine-readable side of `error` when the worker rejected the call (status,
  // `code` such as 'kyc_required' | 'expired' | …, and the copy-only threshold
  // fields). Null for non-worker failures (network, signing, bridge). Set and
  // cleared together with `error`.
  const [errorDetails, setErrorDetails] = useState<RampApiErrorDetails | null>(null);
  const [transactions, setTransactions] = useState<OfframpTransaction[]>([]);
  const [active, setActive] = useState<CreateResult | null>(null);
  const [bridgeRoute, setBridgeRoute] = useState<BridgeRoute | null>(null);
  // Transfers signed here but not yet recorded by the worker (lib/yellowcard/pendingDeposit),
  // keyed by off-ramp id — mirrored in storage BEFORE each broadcast.
  const [pendingDeposits, setPendingDepositsState] = useState<PendingDeposits>({});
  const pendingDepositsRef = useRef<PendingDeposits>({});
  // Records the worker would not confirm for 15 minutes in THIS visit (kept: the next visit retries).
  const [stalledDeposits, setStalledDeposits] = useState<Record<string, true>>({});
  // Per record, this visit: when it was last sent to the worker, and since when it keeps failing.
  const depositAttemptsRef = useRef<Record<string, { lastAt: number; failingSince: number | null }>>({});

  const setPendingDeposits = useCallback(
    (next: PendingDeposits) => {
      pendingDepositsRef.current = next;
      setPendingDepositsState(next);
      if (address) savePendingDeposits(browserStore(), address, next);
    },
    [address],
  );

  useEffect(() => {
    const loaded = address ? loadPendingDeposits(browserStore(), address) : {};
    pendingDepositsRef.current = loaded;
    setPendingDepositsState(loaded);
  }, [address]);

  const mintBearer = useCallback(async (): Promise<string> => {
    if (!did) throw new Error('Not signed in');
    return mintOfframpBearer(did);
  }, [did]);

  /**
   * Tell the worker about a signed transfer (`POST /offramp/{id}/deposit`). Recorded or
   * failed on chain → the record goes; refused → kept as "couldn't confirm" (never re-sent);
   * not reachable / not indexed yet → kept and tried again later. Returns what happened.
   */
  const recordDeposit = useCallback(
    async (offrampId: string, txHash: string): Promise<'recorded' | 'retry' | 'not_through' | 'refused' | 'elsewhere'> => {
      const attempts = depositAttemptsRef.current;
      const now = Date.now();
      attempts[offrampId] = { lastAt: now, failingSince: attempts[offrampId]?.failingSince ?? null };
      try {
        await notifyDeposit(
          offrampId,
          { skipTxHash: txHash, skipStatus: 'broadcast', sourceDenom: SOURCE_DENOM },
          await mintBearer(),
        );
        setPendingDeposits(withoutDeposit(pendingDepositsRef.current, offrampId));
        delete attempts[offrampId];
        return 'recorded';
      } catch (err) {
        const failure = classifyDepositError(err);
        console.warn('[offramp] deposit not recorded yet', err);
        if (failure.kind === 'tx_failed') {
          setPendingDeposits(withoutDeposit(pendingDepositsRef.current, offrampId));
          return 'not_through';
        }
        if (failure.kind === 'refused' || failure.kind === 'already_recorded') {
          const entry = pendingDepositsRef.current[offrampId];
          if (entry) setPendingDeposits(withDeposit(pendingDepositsRef.current, { ...entry, state: 'unconfirmed' }));
          return failure.kind === 'refused' ? 'refused' : 'elsewhere';
        }
        attempts[offrampId].failingSince = attempts[offrampId].failingSince ?? now;
        return 'retry';
      }
    },
    [mintBearer, setPendingDeposits],
  );

  const refreshTransactions = useCallback(async () => {
    const bearer = await mintBearer();
    const res = await listOfframps(bearer);
    setTransactions(res.transactions);
    return res.transactions;
  }, [mintBearer]);

  /** Price the Skip bridge (ixo→Base) — how much USDC survives the hop. */
  const quoteBridge = useCallback(
    async (amountUsdc: number): Promise<BridgeRoute> => {
      const r = await getBridgeRoute({ amountInMicro: toMicro(amountUsdc) });
      setBridgeRoute(r);
      return r;
    },
    [],
  );

  /** Price the route AND resolve every address it needs except the deposit
   *  address. Throws for an unexpected chain — always called BEFORE a YellowCard
   *  sell is created, so nothing is left orphaned. */
  const prepareRoute = useCallback(
    async (amountUsdc: number): Promise<PreparedRoute> => {
      if (!address) throw new Error('Wallet address not available');
      const route = await quoteBridge(amountUsdc);
      // The worker's config is only fetched when the route asks for a recovery chain.
      const recoveryAddresses = routeNeedsRecoveryAddresses(route.requiredChainAddresses)
        ? (await fetchOfframpConfig()).skip_chain_addresses
        : undefined;
      const preSell = resolvePreSellChainAddresses({
        requiredChainAddresses: route.requiredChainAddresses,
        ixoAddress: address,
        recoveryAddresses,
      });
      return { route, preSell };
    },
    [address, quoteBridge],
  );

  /** Build + check the Skip messages, sign, remember the hash for this off-ramp BEFORE
   *  broadcast, broadcast via the session-key signer, then register it with Skip's relay.
   *  `onSigning` fires right before the signature (from then on money may move).
   *  Returns the ixo source tx hash; a broadcast that may still land is returned too. */
  const sendBridge = useCallback(
    async (params: {
      offrampId: string;
      amountUsdc: number;
      destinationAddress: string;
      prepared?: PreparedRoute;
      onSigning: () => void;
    }): Promise<string> => {
      if (!address) throw new Error('Wallet address not available');
      const amountInMicro = toMicro(params.amountUsdc);

      const { route: r, preSell } = params.prepared ?? (await prepareRoute(params.amountUsdc));
      const chainIdsToAddresses = completeChainAddresses({
        requiredChainAddresses: r.requiredChainAddresses,
        preSell,
        destinationAddress: params.destinationAddress,
      });

      const { chainId, msgs } = await buildBridgeTx({
        amountInMicro,
        quotedAmountOutMicro: r.amountOutMicro,
        userAddress: address,
        chainIdsToAddresses,
      });

      // jambo's session-key signer wraps the messages with the smart-account
      // TxExtension and broadcasts; the auth provider shows the signing modal.
      params.onSigning();
      // Set by `onSigned` (inside the signer), before broadcast.
      const signed: { hash: string | null } = { hash: null };
      try {
        const result = await onSign(msgs, 'Withdraw USDC', {
          memo: 'Withdraw USDC',
          onSigned: (txHash) => {
            signed.hash = txHash;
            // The caller tells the worker right after broadcast; the background retry waits.
            depositAttemptsRef.current[params.offrampId] = { lastAt: Date.now(), failingSince: null };
            setPendingDeposits(
              withDeposit(pendingDepositsRef.current, {
                v: 1,
                offrampId: params.offrampId,
                txHash,
                signedAt: Date.now(),
                state: 'pending',
              }),
            );
          },
        });
        signed.hash = result?.transactionHash?.toUpperCase() ?? signed.hash;
      } catch (err) {
        // Nothing went out (refused, or failed in its block): forget it so it can be sent again.
        if (!(err instanceof SignBroadcastError && err.stage === 'maybe_sent' && signed.hash)) {
          setPendingDeposits(withoutDeposit(pendingDepositsRef.current, params.offrampId));
          throw err;
        }
        // Accepted for broadcast but not seen in a block yet: it may still land — keep it.
        console.warn('[offramp] broadcast not confirmed yet; tracking it', err);
      }
      const hash = signed.hash;
      if (!hash) throw new Error('No transaction hash returned from signing');

      void trackTx(chainId, hash).catch(() => undefined);
      return hash;
    },
    [address, onSign, prepareRoute, setPendingDeposits],
  );

  /** Preview a withdrawal end-to-end: price the bridge, then quote YC on the
   *  amount that actually arrives so `fiatReceived` is net of both fees. */
  const previewWithdrawal = useCallback(
    async (params: {
      amountUsdc: number;
      currency: string;
      channelType: string;
      country: string;
      skipBridge?: boolean;
    }): Promise<WithdrawalPreview> => {
      // TEMP (testnet): no Skip route exists for sandbox USDC — quote YC directly
      // on the entered amount (no bridge leg, no bridge fee).
      let bridgedUsdc = params.amountUsdc;
      let skipFeeUsd = 0;
      if (!params.skipBridge) {
        const route = await quoteBridge(params.amountUsdc);
        bridgedUsdc = Number(route.amountOutMicro) / 1e6;
        skipFeeUsd =
          route.usdAmountIn != null && route.usdAmountOut != null
            ? Math.max(0, Number(route.usdAmountIn) - Number(route.usdAmountOut))
            : Math.max(0, params.amountUsdc - bridgedUsdc);
      }
      const bearer = await mintBearer();
      const quote = await quoteOfframp(
        {
          cryptoAmount: bridgedUsdc,
          currency: params.currency,
          channelType: params.channelType,
          country: params.country,
          network: OFFRAMP_DESTINATION.cryptoNetwork,
        },
        bearer,
      );
      return { quote, sendUsdc: params.amountUsdc, bridgedUsdc, skipFeeUsd };
    },
    [quoteBridge, mintBearer],
  );

  /**
   * Full off-ramp:
   *  1. price the Skip route (always the withdrawable USDC) and resolve its
   *     addresses (throws for an unroutable route — before anything is created);
   *  2. authorize (UCAN) + create the YC sell (with `sourceDenom`) → get the
   *     crypto deposit address;
   *  3. bridge the user's ixo USDC to that address via Skip (user signs);
   *  4. notify the worker of the source tx (+ `sourceDenom`) so it can track to completion.
   */
  const withdraw = useCallback(
    async (params: WithdrawParams): Promise<CreateResult> => {
      setError(null);
      setErrorDetails(null);
      // Flips once the user is asked to sign the bridge transfer. Before that
      // nothing has left their wallet — a create refusal (incl. the decision
      // rail's 403/503s) never got past the worker — so the error copy may say
      // so; after it, it must not.
      let fundsMayHaveMoved = false;
      const sourceDenom = SOURCE_DENOM;
      try {
        setStage('authorizing');
        const createBearer = await mintBearer();

        // Re-price the Skip bridge NOW so the YC sell is created for the amount
        // that will ACTUALLY arrive, and resolve every address the route needs
        // BEFORE creating the sell — an unexpected chain throws here and never leaves an orphaned sell. The same route is reused
        // for the broadcast below — no drift between what YC expects and what we send.
        setStage('creating');
        // TEMP (testnet): skip the Skip bridge — use the entered amount directly
        // with no bridge fee, and don't price a route.
        let arrivingUsdc = params.amountUsdc;
        let skipFeeUsd = 0;
        let prepared: PreparedRoute | undefined;
        if (!params.skipBridge) {
          prepared = await prepareRoute(params.amountUsdc);
          const route = prepared.route;
          arrivingUsdc = Number(route.amountOutMicro) / 1e6;
          skipFeeUsd =
            route.usdAmountIn != null && route.usdAmountOut != null
              ? Math.max(0, Number(route.usdAmountIn) - Number(route.usdAmountOut))
              : Math.max(0, params.amountUsdc - arrivingUsdc);
        }

        const created = await createOfframp(
          {
            cryptoAmount: arrivingUsdc,
            sendAmountUsdc: params.amountUsdc,
            skipFeeUsd,
            currency: params.currency,
            channelType: params.channelType,
            network: OFFRAMP_DESTINATION.cryptoNetwork,
            customer: params.customer,
            destination: params.destination,
            // Only when we actually hold one — never an empty string.
            ...(params.kycCredential ? { kycCredential: params.kycCredential } : {}),
            // Not in testnet test mode: nothing is bridged there, and the stand-in
            // denom is not one the worker accepts.
            ...(params.skipBridge ? {} : { sourceDenom }),
          },
          createBearer,
        );
        setActive(created);
        void refreshTransactions().catch(() => undefined);

        // TEMP (testnet): the YC sell is created — stop here (no bridge, no
        // deposit notify). Lets us verify the create/KYC/momo destination flow.
        if (params.skipBridge) {
          setStage('submitted');
          await refreshTransactions().catch(() => undefined);
          return created;
        }

        if (!created.deposit_address) {
          throw new Error('YellowCard did not return a deposit address for this sell. Check the worker logs.');
        }

        setStage('bridging');
        const sourceTxHash = await sendBridge({
          offrampId: created.id,
          amountUsdc: params.amountUsdc,
          destinationAddress: created.deposit_address,
          prepared,
          // Only from the signature on may money have moved (not while the route is checked).
          onSigning: () => {
            fundsMayHaveMoved = true;
          },
        });

        setStage('notifying');
        const recorded = await recordDeposit(created.id, sourceTxHash);
        // `retry`: the transfer is on its way and remembered here; the worker is told again
        // shortly (the history shows it as sending). The others need the customer to know.
        if (recorded === 'not_through' || recorded === 'refused' || recorded === 'elsewhere') {
          setStage('error');
          setError(
            recorded === 'not_through'
              ? OFFRAMP_NOT_THROUGH
              : recorded === 'refused'
              ? OFFRAMP_DEPOSIT_UNCONFIRMED
              : OFFRAMP_DEPOSIT_RECORDED_ELSEWHERE,
          );
          setErrorDetails(null);
          await refreshTransactions().catch(() => undefined);
          return created;
        }

        setStage('submitted');
        await refreshTransactions().catch(() => undefined);
        return created;
      } catch (err) {
        // Nothing was created: `active` stays as it was and the caller's form
        // keeps its values, so the same withdrawal can simply be sent again —
        // which is how a `decision_pending` / `decision_in_review` resumes.
        setStage('error');
        setError(offrampErrorMessage(err, { fundsMayHaveMoved }));
        setErrorDetails(rampApiErrorDetails(err));
        throw err;
      }
    },
    [mintBearer, prepareRoute, sendBridge, recordDeposit, refreshTransactions],
  );

  /** Re-run ONLY the bridge leg for an existing sell whose YC settlement is
   *  still open (deposit address unchanged), for when the first attempt was
   *  cancelled / failed before the crypto reached YellowCard. Always bridges the
   *  withdrawable USDC — the screen does not offer this for a legacy-USDC row
   *  (the worker 409s a denom other than the stored one), nor while a transfer
   *  signed for this withdrawal is still unrecorded (`pendingDeposits`). */
  const retryBridge = useCallback(
    async (tx: OfframpTransaction): Promise<void> => {
      if (!tx.deposit_address) throw new Error('No deposit address on this withdrawal.');
      if (pendingDepositsRef.current[tx.id]) throw new Error('A transfer for this withdrawal is still being checked.');
      const amountUsdc = tx.send_amount_usdc ?? tx.amount_usd;
      if (amountUsdc == null) throw new Error('Unknown send amount for this withdrawal.');
      setError(null);
      setErrorDetails(null);
      let fundsMayHaveMoved = false;
      try {
        const prepared = await prepareRoute(amountUsdc);
        const sourceTxHash = await sendBridge({
          offrampId: tx.id,
          amountUsdc,
          destinationAddress: tx.deposit_address,
          prepared,
          onSigning: () => {
            fundsMayHaveMoved = true;
          },
        });
        const recorded = await recordDeposit(tx.id, sourceTxHash);
        if (recorded === 'not_through') setError(OFFRAMP_NOT_THROUGH);
        else if (recorded === 'refused') setError(OFFRAMP_DEPOSIT_UNCONFIRMED);
        else if (recorded === 'elsewhere') setError(OFFRAMP_DEPOSIT_RECORDED_ELSEWHERE);
        await refreshTransactions().catch(() => undefined);
      } catch (err) {
        setError(offrampErrorMessage(err, { fundsMayHaveMoved }));
        setErrorDetails(rampApiErrorDetails(err));
        throw err;
      }
    },
    [prepareRoute, sendBridge, recordDeposit, refreshTransactions],
  );

  // Signed transfers the worker has not recorded yet: tell it again (every 15 s at most per
  // record, for up to 15 min per visit), drop records it has (or that never went out).
  useEffect(() => {
    const entries = Object.values(pendingDeposits);
    if (!did || entries.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const entry of entries) {
        if (cancelled) return;
        const row = transactions.find((t) => t.id === entry.offrampId);
        if (row?.skip_tx_hash && row.skip_tx_hash.toUpperCase() === entry.txHash) {
          setPendingDeposits(withoutDeposit(pendingDepositsRef.current, entry.offrampId));
          continue;
        }
        if (entry.state !== 'pending' || stalledDeposits[entry.offrampId]) continue;
        const a = depositAttemptsRef.current[entry.offrampId];
        const now = Date.now();
        if (a && now - a.lastAt < DEPOSIT_RETRY_EVERY_MS) continue;
        if (a?.failingSince != null && now - a.failingSince >= DEPOSIT_RETRY_BUDGET_MS) {
          // Not recordable for 15 minutes: never went out? The chain says.
          const onChain = await lookupIxoTx(entry.txHash);
          if ((onChain?.found && onChain.code !== 0) || (onChain && !onChain.found && now - entry.signedAt > DEPOSIT_NOT_FOUND_AFTER_MS)) {
            setPendingDeposits(withoutDeposit(pendingDepositsRef.current, entry.offrampId));
          } else {
            setStalledDeposits((s) => ({ ...s, [entry.offrampId]: true }));
          }
          continue;
        }
        await recordDeposit(entry.offrampId, entry.txHash);
      }
    };
    void run();
    const timer = setInterval(() => void run(), DEPOSIT_RETRY_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [did, pendingDeposits, stalledDeposits, transactions, recordDeposit, setPendingDeposits]);

  // What the history shows per withdrawal: still being recorded, or "couldn't confirm".
  const depositStates: Record<string, 'pending' | 'unconfirmed'> = {};
  for (const entry of Object.values(pendingDeposits)) {
    depositStates[entry.offrampId] = stalledDeposits[entry.offrampId] ? 'unconfirmed' : entry.state;
  }

  const pollTransaction = useCallback(
    async (id: string): Promise<OfframpTransaction> => {
      const bearer = await mintBearer();
      const res = await getOfframp(id, bearer);
      return res.transaction;
    },
    [mintBearer],
  );

  const downloadPaymentRecord = useCallback(
    async (id: string): Promise<Blob> => {
      const bearer = await mintBearer();
      return fetchPaymentRecordPdf(id, bearer);
    },
    [mintBearer],
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorDetails(null);
  }, []);

  return {
    stage,
    error,
    errorDetails,
    active,
    transactions,
    /** Transfers signed for these withdrawals but not recorded by the worker yet (by off-ramp
     *  id): never offer to send these again. `unconfirmed` = the worker could not confirm it. */
    depositStates,
    bridgeRoute,
    previewWithdrawal,
    withdraw,
    retryBridge,
    refreshTransactions,
    pollTransaction,
    downloadPaymentRecord,
    clearError,
  };
}
