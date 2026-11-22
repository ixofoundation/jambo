import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ixo } from '@ixo/impactxclient-sdk';

import { AIRTIME_VOUCHER_URL } from '@constants/airtimeVoucher';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { noteKycCredentialRejected, selectKycCredentialJwt } from '@utils/approvePayment';
import { waitForKycCredentialSource } from '@utils/kycPrefill';
import { ensureEd25519OnChain } from '@utils/ucanDelegation';
import { mintSwapToken } from '@utils/ucanAirtimeVoucher';
import { track } from 'lib/analytics/client';
import { AnalyticsEvents, type AirtimeSwapStage } from 'lib/analytics/events';
import { checkSwapBurn, swapBurnGas } from 'lib/airtimeVoucher/burn';
import { createAirtimeVoucherClient } from 'lib/airtimeVoucher/client';
import { isAirtimeVoucherError } from 'lib/airtimeVoucher/errors';
import { flaggedCopy, refusalCopy, type RefusalCopy } from 'lib/airtimeVoucher/messages';
import { redeemUntilSettled } from 'lib/airtimeVoucher/redeem';
import {
  EMPTY_BOOK,
  canSignBurn,
  findSwap,
  loadSwapBook,
  openSwap,
  saveSwapBook,
  storedBurnMessage,
  swapFromResponse,
  swapNeed,
  withBroadcastBurn,
  withBurnNotMade,
  withServiceDetail,
  withSignedBurn,
  withSwap,
  withVouchers,
  type KeyValueStore,
  type StoredSwap,
  type SwapBook,
} from 'lib/airtimeVoucher/swapStore';
import { accountDid } from 'lib/airtimeVoucher/swapToken';
import {
  SWAP_BURN_TYPE_URL,
  type ServiceInfo,
  type Swap,
  type SwapBurnMessage,
  type SwapDetail,
  type SwapPin,
} from 'lib/airtimeVoucher/types';

/**
 * Drives the airtime swap screen (screens/airtimeSwap.tsx): ask the service
 * for a swap, burn the vouchers it names, redeem the burn for a PIN. The pure
 * parts are in lib/airtimeVoucher; see docs/airtime-swap.md.
 *
 * Two promises this hook keeps:
 * - A swap is never burned for twice. The burn is signed only when
 *   `canSignBurn` says so: nothing was signed for the swap, or what was signed
 *   provably burned nothing. Once a transaction is signed its hash is saved
 *   BEFORE it is broadcast, and from then on the swap is only redeemed.
 * - A burned swap never loses its PIN. The swap is saved before signing, so
 *   after a reload, a closed tab or a sign-out it is redeemed again with the
 *   stored hash, or read from the service. The PIN itself is never stored: it
 *   lives in this hook's state while it is on screen.
 */

export type SwapStep = 'asking' | 'burning' | 'issuing' | 'reading';

export type SwapView =
  | { kind: 'loading' }
  /** The service could not be reached at all (`GET /api`). */
  | { kind: 'unavailable'; copy: RefusalCopy }
  | { kind: 'amount' }
  /** `swap`: an open swap being finished; null for a new one (asked for on confirm). */
  | { kind: 'confirm'; amount: number; swap: StoredSwap | null }
  | { kind: 'working'; step: SwapStep; amount: number | null }
  | { kind: 'pin'; swap: StoredSwap; pin: SwapPin }
  /** The burn is verified; the PIN is not issued yet. `message` is the service's own text. */
  | { kind: 'owed'; swap: StoredSwap; message: string | null }
  /** A burn was sent and the service cannot see it on chain yet. */
  | { kind: 'burn_sent'; swap: StoredSwap; message: string | null }
  /** Open at the service, but this device cannot finish it. */
  | { kind: 'open_elsewhere'; swap: StoredSwap }
  /** `retryAt`: ms since epoch before which trying again will be refused. */
  | { kind: 'refused'; copy: RefusalCopy; swap: StoredSwap | null; amount: number | null; retryAt: number | null };

const STORAGE_COPY: RefusalCopy = {
  code: 'local_storage',
  title: 'This browser can’t save your swap',
  body: 'A swap must be saved on this device before your vouchers are used, so that your PIN can never be lost. Nothing was taken from your vouchers. Turn off private browsing or free up some space, then try again in a few minutes.',
  action: 'none',
};

/** The service asks for an identity credential and this user holds none. */
const NO_KYC_COPY: RefusalCopy = {
  code: 'kyc_required',
  title: 'Verify your identity first',
  body: 'Swapping vouchers for airtime needs your identity to be verified. Nothing was taken from your vouchers.',
  action: 'verify',
};

/** The Vault could not be read, so it is not known whether the user holds one. */
const KYC_UNREAD_COPY: RefusalCopy = {
  code: 'local_kyc_unread',
  title: 'We couldn’t read your identity verification',
  body: 'Nothing was taken from your vouchers. Please try again in a moment.',
  action: 'retry',
};

const NOT_SENT_COPY: RefusalCopy = {
  code: 'burn_not_sent',
  title: 'Nothing was used',
  body: 'The transaction did not go through, so your vouchers are still in your wallet. You can try again.',
  action: 'burn_again',
};

const RAN_OUT_COPY: RefusalCopy = {
  code: 'swap_expired',
  title: 'This swap ran out of time',
  body: 'Nothing was taken from your vouchers. Start again when you are ready.',
  action: 'amount',
};

function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export default function useAirtimeSwap() {
  const { address, onSign, matrixRoomId } = useAuth();
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);

  /**
   * The user's identity credential (the SD-JWT to present), from their
   * Vault: null when they hold none. Throws when the Vault cannot be read,
   * which is not the same as holding none.
   */
  const loadKyc = useCallback(async (): Promise<string | null> => {
    await awaitCompletion();
    const mxClient = getMatrixClient();
    if (!mxClient || !matrixRoomId) throw new Error('Vault client not available');
    // Waits out a client that is still syncing: a read right after sign-in
    // can miss the credential and wrongly treat a verified user as not.
    const source = await waitForKycCredentialSource(mxClient, matrixRoomId);
    if (!source) return null;
    return (await selectKycCredentialJwt(mxClient, matrixRoomId)).jwt;
  }, [awaitCompletion, getMatrixClient, matrixRoomId]);
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [book, setBook] = useState<SwapBook>(EMPTY_BOOK);
  const [view, setViewState] = useState<SwapView>({ kind: 'loading' });

  const bookRef = useRef<SwapBook>(EMPTY_BOOK);
  const infoRef = useRef<ServiceInfo | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const keyChecked = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setView = useCallback((next: SwapView) => {
    if (mounted.current) setViewState(next);
  }, []);

  const client = useMemo(
    () =>
      createAirtimeVoucherClient({
        baseUrl: AIRTIME_VOUCHER_URL,
        signToken: (request) => {
          if (!address) return Promise.reject(new Error('Not signed in'));
          return mintSwapToken(address, request);
        },
      }),
    [address],
  );

  /** Keeps the in-memory book and the stored one in step. False when storage did not take it. */
  const commit = useCallback(
    (next: SwapBook): boolean => {
      bookRef.current = next;
      if (mounted.current) setBook(next);
      return address ? saveSwapBook(browserStore(), address, next) : false;
    },
    [address],
  );

  const putSwap = useCallback((swap: StoredSwap): boolean => commit(withSwap(bookRef.current, swap)), [commit]);

  const latest = useCallback((swap: StoredSwap): StoredSwap => findSwap(bookRef.current, swap.id) ?? swap, []);

  const refuse = useCallback(
    (
      copy: RefusalCopy,
      stage: AirtimeSwapStage,
      swap: StoredSwap | null,
      amount: number | null = swap?.amount ?? null,
    ) => {
      track(AnalyticsEvents.AirtimeSwapRefused, { stage, code: copy.code });
      setView({
        kind: 'refused',
        copy,
        swap,
        amount,
        retryAt: copy.action === 'wait' && copy.waitSec !== undefined ? Date.now() + copy.waitSec * 1000 : null,
      });
    },
    [setView],
  );

  const limits = useCallback(() => ({ minZar: infoRef.current?.minSwapZar, maxZar: infoRef.current?.maxSwapZar }), []);

  /**
   * The service verifies a token against the Ed25519 key in the account's DID
   * document on chain. Registered once per account (one transaction when it
   * is missing; most accounts have it from their first claim). Best effort: if
   * the check itself fails, the service's own answer says what is wrong.
   */
  const ensureKey = useCallback(async () => {
    if (!address) return;
    if (!keyChecked.current) {
      keyChecked.current = ensureEd25519OnChain({ did: accountDid(address), address, onSign }).catch(() => {
        keyChecked.current = null;
      });
    }
    await keyChecked.current;
  }, [address, onSign]);

  /** Shows where a swap stands, from what the service just said about it. */
  const showDetail = useCallback(
    (record: StoredSwap, detail: SwapDetail, reread: boolean) => {
      if (detail.pin) {
        if (reread) track(AnalyticsEvents.AirtimePinViewed);
        setView({ kind: 'pin', swap: record, pin: detail.pin });
        return;
      }
      const need = swapNeed(record, Date.now());
      if (need === 'owed' || need === 'pin') setView({ kind: 'owed', swap: record, message: detail.message });
      else if (need === 'flagged') refuse(flaggedCopy(), 'read', record);
      else if (need === 'burn_sent') setView({ kind: 'burn_sent', swap: record, message: detail.message });
      else if (need === 'ready') setView({ kind: 'confirm', amount: record.amount, swap: record });
      else if (need === 'open_elsewhere') setView({ kind: 'open_elsewhere', swap: record });
      else refuse(RAN_OUT_COPY, 'read', record);
    },
    [refuse, setView],
  );

  /** `GET /api/swaps/{id}`: the swap as the service has it, and its PIN once issued. */
  const refresh = useCallback(
    async (swapId: string, reread = false) => {
      const known = findSwap(bookRef.current, swapId);
      setView({ kind: 'working', step: 'reading', amount: known?.amount ?? null });
      try {
        await ensureKey();
        const detail = await client.getSwap(swapId);
        const record = withServiceDetail(findSwap(bookRef.current, swapId), detail, Date.now());
        putSwap(record);
        showDetail(record, detail, reread);
      } catch (err) {
        refuse(refusalCopy(err, { stage: 'read', ...limits() }), 'read', known);
      }
    },
    [client, ensureKey, limits, putSwap, refuse, setView, showDetail],
  );

  /** `POST /api/swaps/{id}/redeem` with the stored hash, repeated while the answer is "not yet". */
  const redeem = useCallback(
    async (swap: StoredSwap) => {
      const txHash = swap.txHash;
      if (!txHash) {
        await refresh(swap.id);
        return;
      }
      setView({ kind: 'working', step: 'issuing', amount: swap.amount });
      try {
        await ensureKey();
        const outcome = await redeemUntilSettled({
          client,
          swapId: swap.id,
          txHash,
          onAnswer: (detail) => void putSwap(withServiceDetail(latest(swap), detail, Date.now())),
          cancelled: () => !mounted.current,
        });
        const record = latest(swap);
        if (outcome.kind === 'issued' && outcome.detail.pin) {
          track(AnalyticsEvents.AirtimeSwapCompleted, { amountZar: record.amount, test: outcome.detail.pin.test });
          setView({ kind: 'pin', swap: record, pin: outcome.detail.pin });
        } else if (outcome.kind === 'owed') {
          track(AnalyticsEvents.AirtimeSwapOwed, { amountZar: record.amount });
          setView({ kind: 'owed', swap: record, message: outcome.detail.message });
        } else if (outcome.kind === 'not_visible') {
          setView({ kind: 'burn_sent', swap: record, message: outcome.detail.message });
        } else if (outcome.kind === 'unreachable') {
          refuse(refusalCopy(outcome.error, { stage: 'redeem', ...limits() }), 'redeem', record);
        } else {
          setView({ kind: 'owed', swap: record, message: outcome.detail.message });
        }
      } catch (err) {
        const record = latest(swap);
        const code = isAirtimeVoucherError(err) ? err.code : null;
        if (code === 'swap_burn_failed') {
          // In a block with a failure code: nothing was burned, so the swap may be burned for again.
          const reopened = withBurnNotMade(record, Date.now());
          putSwap(reopened);
          refuse(refusalCopy(err, { stage: 'redeem', ...limits() }), 'redeem', reopened);
        } else if (
          code === 'swap_flagged' ||
          (code === 'swap_burn_invalid' && isAirtimeVoucherError(err) && err.details.flagged === true)
        ) {
          const flagged: StoredSwap = { ...record, status: 'flagged', burn: 'broadcast', updatedAt: Date.now() };
          putSwap(flagged);
          track(AnalyticsEvents.AirtimeSwapFlagged, { amountZar: flagged.amount });
          refuse(refusalCopy(err, { stage: 'redeem', ...limits() }), 'redeem', flagged);
        } else if (code === 'swap_already_redeemed') {
          await refresh(swap.id);
        } else {
          refuse(refusalCopy(err, { stage: 'redeem', ...limits() }), 'redeem', record);
        }
      }
    },
    [client, ensureKey, latest, limits, putSwap, refresh, refuse, setView],
  );

  /**
   * Signs and broadcasts the burn of an open swap, then redeems it. `asked` is
   * what the service answered (a new swap); for a swap being finished later
   * the stored burn is checked the same way.
   */
  const burn = useCallback(
    async (swap: StoredSwap, amount: number, asked?: { burn: SwapBurnMessage; swap: Swap }) => {
      if (!address) return;
      // The one gate. Anything else (a burn already signed, no time left) is never signed here.
      if (!canSignBurn(swap, Date.now())) {
        if (swap.burn !== 'none') await redeem(swap);
        else refuse(RAN_OUT_COPY, 'burn', swap);
        return;
      }
      let fields;
      try {
        fields = checkSwapBurn({
          burn: asked?.burn ?? storedBurnMessage(swap, address),
          swap: asked?.swap ?? {
            reference: swap.reference,
            address,
            amount: swap.amount,
            expiresAt: swap.expiresAt,
            status: swap.status,
          },
          address,
          amount,
          nowMs: Date.now(),
        });
      } catch (err) {
        refuse(refusalCopy(err, { stage: 'burn', ...limits() }), 'burn', swap);
        return;
      }

      setView({ kind: 'working', step: 'burning', amount });
      let current = swap;
      try {
        await onSign(
          [{ typeUrl: SWAP_BURN_TYPE_URL, value: ixo.token.v1beta1.MsgTransferCredit.fromPartial(fields) }],
          'Swap vouchers for airtime',
          {
            memo: 'Airtime swap',
            gas: swapBurnGas(fields.tokens.length),
            // After signing, BEFORE broadcast. If the hash cannot be saved, this throws and nothing is broadcast.
            onSigned: (txHash) => {
              const signed = withSignedBurn(current, txHash, Date.now());
              if (!putSwap(signed)) throw new Error('The swap could not be saved before sending the burn');
              current = signed;
            },
          },
        );
        current = withBroadcastBurn(current, Date.now());
        putSwap(current);
        track(AnalyticsEvents.AirtimeSwapBurnSent, { amountZar: amount });
      } catch (err) {
        const stage = (err as { stage?: unknown } | null)?.stage;
        // `not_sent`: refused before or at broadcast. `failed_on_chain`: in a block with a failure
        // code. Either way nothing was burned, and the swap may be burned for again. Anything else
        // after a signature (`maybe_sent`) is unknown: the swap is only redeemed from here on.
        if (current.burn === 'none' || stage === 'not_sent' || stage === 'failed_on_chain') {
          const reopened = withBurnNotMade(latest(swap), Date.now());
          putSwap(reopened);
          refuse(canSignBurn(reopened, Date.now()) ? NOT_SENT_COPY : RAN_OUT_COPY, 'burn', reopened);
          return;
        }
        track(AnalyticsEvents.AirtimeSwapBurnSent, { amountZar: amount });
      }
      await redeem(latest(current));
    },
    [address, latest, limits, onSign, putSwap, redeem, refuse, setView],
  );

  /** `POST /api/swaps`, then the burn. Only ever called from the confirm step. */
  const ask = useCallback(
    async (amount: number) => {
      setView({ kind: 'working', step: 'asking', amount });
      track(AnalyticsEvents.AirtimeSwapStarted, { amountZar: amount });
      let response;
      // The identity credential, where the service asks for one. It is read
      // before anything is asked, so a user without one is sent to verify
      // rather than refused by the service.
      let kyc: string | null = null;
      try {
        if ((await client.getServiceInfo()).requires?.kyc === true) {
          let read: string | null;
          try {
            read = await loadKyc();
          } catch {
            refuse(KYC_UNREAD_COPY, 'request', null, amount);
            return;
          }
          if (!read) {
            refuse(NO_KYC_COPY, 'request', null, amount);
            return;
          }
          kyc = read;
        }
        await ensureKey();
        response = await client.requestSwap(amount, kyc ?? undefined);
      } catch (err) {
        // A credential the service would not take is not offered again this
        // session: the next try sends the user's other one, if they hold it.
        if (
          isAirtimeVoucherError(err) &&
          (err.code === 'kyc_invalid' || err.code === 'kyc_expired' || err.code === 'kyc_revoked')
        ) {
          await noteKycCredentialRejected(kyc);
        }
        const copy = refusalCopy(err, { stage: 'request', ...limits() });
        if (copy.held !== undefined) commit(withVouchers(bookRef.current, copy.held, Date.now()));
        let already: StoredSwap | null = null;
        if (copy.action === 'resume' && copy.swapId) {
          already = findSwap(bookRef.current, copy.swapId);
          try {
            const detail = await client.getSwap(copy.swapId);
            already = withServiceDetail(already, detail, Date.now());
            putSwap(already);
          } catch {
            // The stored record, if any, still says enough to offer it.
          }
        }
        refuse(copy, 'request', already, amount);
        return;
      }
      const now = Date.now();
      const held = response.holdings.reduce((sum, holding) => sum + (Number(holding?.amount) || 0), 0);
      const swap = swapFromResponse(response, now);
      // Saved BEFORE anything is signed: a swap this browser cannot remember is not burned for.
      if (!commit(withSwap(withVouchers(bookRef.current, held, now), swap))) {
        refuse(STORAGE_COPY, 'request', null, amount);
        return;
      }
      await burn(swap, amount, { burn: response.burn, swap: response.swap });
    },
    [burn, client, commit, ensureKey, limits, loadKyc, putSwap, refuse, setView],
  );

  /** Takes the user to wherever a stored swap stands. Never signs anything by itself. */
  const open = useCallback(
    async (swap: StoredSwap, reread = false) => {
      const need = swapNeed(swap, Date.now());
      if (need === 'ready') setView({ kind: 'confirm', amount: swap.amount, swap });
      else if (need === 'burn_sent' || need === 'owed') await redeem(swap);
      else if (need === 'flagged')
        setView({ kind: 'refused', copy: flaggedCopy(), swap, amount: swap.amount, retryAt: null });
      else if (need === 'expired') setView({ kind: 'amount' });
      else await refresh(swap.id, reread);
    },
    [redeem, refresh, setView],
  );

  /** One action at a time: a second tap while one runs does nothing. */
  const exclusive = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } finally {
      busy.current = false;
    }
  }, []);

  // On arrival: the service's limits, the stored swaps, and straight back into an unfinished swap.
  const start = useCallback(
    () =>
      exclusive(async () => {
        if (!address) return;
        setView({ kind: 'loading' });
        const stored = loadSwapBook(browserStore(), address);
        bookRef.current = stored;
        if (mounted.current) setBook(stored);
        try {
          const serviceInfo = await client.getServiceInfo();
          infoRef.current = serviceInfo;
          if (mounted.current) setInfo(serviceInfo);
        } catch (err) {
          setView({ kind: 'unavailable', copy: refusalCopy(err, { stage: 'read' }) });
          return;
        }
        const unfinished = openSwap(stored, Date.now());
        if (unfinished) await open(unfinished);
        else setView({ kind: 'amount' });
      }),
    [address, client, exclusive, open, setView],
  );

  useEffect(() => {
    void start();
    // Runs once per account: `start` changes identity with `onSign`, which must not restart the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const actions = useMemo(
    () => ({
      /** Load again after `unavailable`. */
      reload: () => start(),
      /** From the amount step to the confirm step. Nothing is asked of the service yet. */
      chooseAmount: (amount: number) => setView({ kind: 'confirm', amount, swap: null }),
      /** Back to the amount step. */
      toAmount: () => {
        if (!busy.current) setView({ kind: 'amount' });
      },
      /** The user confirmed: ask for the swap (or take the open one) and burn. */
      confirm: () =>
        exclusive(async () => {
          if (view.kind !== 'confirm') return;
          if (view.swap) await burn(latest(view.swap), view.amount);
          else await ask(view.amount);
        }),
      /** Ask the service again where a swap stands (redeems with the stored hash when there is one). */
      check: (swap: StoredSwap) => exclusive(() => open(latest(swap))),
      /** Open a swap from the list: read its PIN again, or pick up where it stands. */
      openSwap: (swapId: string) =>
        exclusive(async () => {
          const swap = findSwap(bookRef.current, swapId);
          if (swap) await open(swap, true);
          else await refresh(swapId, true);
        }),
    }),
    [ask, burn, exclusive, latest, open, refresh, setView, start, view],
  );

  return { view, info, swaps: book.swaps, vouchers: book.vouchers, ...actions };
}
