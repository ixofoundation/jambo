import { useCallback, useRef, useState } from 'react';
import { cosmos, ixo } from '@ixo/impactxclient-sdk';

import { useAuth } from '@hooks/useAuth';
import {
  CONVERT_FLOAT_LOW_CODE,
  CONVERT_OVER_CAP_CODE,
  CONVERT_TOO_MANY_CODE,
  type ConvertInfo,
  type ConvertStatus,
  fetchConvertInfo,
  fetchConvertStatus,
  nudgeConvertScan,
  requestConvertGrant,
  storeConvertClaim,
} from 'lib/payConvert/client';
import { RampApiError } from 'lib/yellowcard/offrampClient';
import { mintPayConvertBearer } from '@utils/ucanPayConvert';

/** In-flight stage of a conversion, for UI feedback. */
export type PayConvertStage = 'idle' | 'preparing' | 'authorizing' | 'signing' | 'confirming' | 'done' | 'error';

export interface PayConvertResult {
  claimId: string;
  txHash: string;
  /** The oracle confirmed the payout landed. False ⇒ the PAY is sent and the
   *  claim is filed, but the oracle hadn't paid it out before we stopped
   *  waiting — the USDC still arrives, a little later. */
  settled: boolean;
  receiptCid: string | null;
}

/** How long we wait for the oracle after the transaction before handing the
 *  user back to their wallet with an "on its way" note. */
const CONFIRM_TIMEOUT_MS = 4 * 60 * 1000;
// A conversion lands in about half a minute on devnet; polling every two seconds keeps the
// "done" moment close to the real one without hammering the oracle.
const POLL_MS = 2000;

/** Friendly, customer-facing wording for the door's refusals. Never a code. */
export function payConvertErrorMessage(err: unknown): string {
  if (err instanceof RampApiError) {
    if (err.code === CONVERT_OVER_CAP_CODE) return 'You can convert up to $1,000 at a time. Try a smaller amount.';
    if (err.code === CONVERT_FLOAT_LOW_CODE) {
      return 'Conversions are paused for a moment while we top up. Please try again in a little while.';
    }
    if (err.code === CONVERT_TOO_MANY_CODE) {
      return 'You’ve reached the number of conversions allowed for now. Please try again in an hour.';
    }
    if (err.status === 401) return 'Your session needs a refresh — please sign in again and retry.';
    if (err.status === 429) return 'Too many attempts in a row. Give it a minute and try again.';
    return 'We couldn’t start the conversion. Nothing was taken from your wallet — please try again.';
  }
  const message = err instanceof Error ? err.message : '';
  if (/session|sign in|Not authenticated/i.test(message)) return 'Your session needs a refresh — please sign in again and retry.';
  if (/rejected|denied|cancel/i.test(message)) return 'The conversion was cancelled. Nothing was taken from your wallet.';
  return 'Something went wrong converting your rewards. Nothing was taken from your wallet — please try again.';
}

/** What to tell someone whose conversion was refused, given what the oracle says about their PAY. */
export function rejectedMessage(status: Pick<ConvertStatus, 'refund'>): string {
  const refund = status.refund;
  if (!refund || refund.amountBase === '0' || refund.reason === 'none') {
    return 'This conversion couldn’t be completed. Nothing was converted and no PAY was taken.';
  }
  if (refund.status === 'sent') {
    return 'This conversion couldn’t be completed, so your PAY has been returned to your wallet. Nothing was converted — you can try again.';
  }
  return 'This conversion couldn’t be completed. Your PAY is being returned to your wallet automatically — it usually takes a minute. Nothing was converted.';
}

/**
 * One PAY → USDC conversion, the way the oracle's door expects it:
 *  1. read the conversion terms (deed admin, denoms);
 *  2. store the claim body (its CID is the claim id) and mint this user's Submit right;
 *  3. sign ONE transaction: an intent for the USDC, the PAY to the deed, and the claim —
 *     all-or-nothing, so the PAY never leaves without its claim;
 *  4. nudge the oracle and wait for the payout.
 */
export default function usePayConvert() {
  const { address, did, onSign } = useAuth();
  const [stage, setStage] = useState<PayConvertStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PayConvertResult | null>(null);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    cancelled.current = true;
    setStage('idle');
    setError(null);
    setResult(null);
  }, []);

  /** Poll the oracle until the payout lands (or the claim ends another way). */
  const awaitPayout = useCallback(async (claimId: string): Promise<ConvertStatus | null> => {
    const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
    let last: ConvertStatus | null = null;
    while (Date.now() < deadline && !cancelled.current) {
      // The oracle finds the claim on its own within a minute; the nudge makes
      // it look now. Blocksync may not have indexed the claim yet, so a failed
      // nudge is retried on the next loop, never surfaced.
      if (!last || last.stage === 'unknown') await nudgeConvertScan().catch(() => undefined);
      last = await fetchConvertStatus(claimId).catch(() => last);
      if (last && (last.stage === 'paid' || last.stage === 'rejected' || last.stage === 'failed' || last.stage === 'review')) {
        return last;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return last;
  }, []);

  const convert = useCallback(
    async (amountBase: string): Promise<PayConvertResult> => {
      if (!address || !did) throw new Error('Not authenticated');
      cancelled.current = false;
      setError(null);
      setResult(null);
      let info: ConvertInfo;
      let claimId: string;
      try {
        setStage('preparing');
        info = await fetchConvertInfo();

        setStage('authorizing');
        const claim = await storeConvertClaim(await mintPayConvertBearer(did), amountBase);
        claimId = claim.claimId;
        await requestConvertGrant(await mintPayConvertBearer(did), amountBase);
      } catch (err) {
        setStage('error');
        setError(payConvertErrorMessage(err));
        throw err;
      }

      let txHash: string;
      try {
        setStage('signing');
        const intent = {
          typeUrl: '/ixo.claims.v1beta1.MsgClaimIntent',
          value: ixo.claims.v1beta1.MsgClaimIntent.fromPartial({
            agentDid: did,
            agentAddress: address,
            collectionId: info.collectionId,
            amount: [{ denom: info.payoutDenom, amount: amountBase }],
            cw20Payment: [],
            cw1155Payment: [],
          }),
        };
        const send = {
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: cosmos.bank.v1beta1.MsgSend.fromPartial({
            fromAddress: address,
            toAddress: info.admin,
            amount: [{ denom: info.payDenom, amount: amountBase }],
          }),
        };
        const submit = {
          typeUrl: '/cosmos.authz.v1beta1.MsgExec',
          value: cosmos.authz.v1beta1.MsgExec.fromPartial({
            grantee: address,
            msgs: [
              {
                typeUrl: '/ixo.claims.v1beta1.MsgSubmitClaim',
                value: ixo.claims.v1beta1.MsgSubmitClaim.encode(
                  ixo.claims.v1beta1.MsgSubmitClaim.fromPartial({
                    adminAddress: info.admin,
                    agentAddress: address,
                    agentDid: did,
                    claimId,
                    collectionId: info.collectionId,
                    useIntent: true,
                    amount: [],
                    cw20Payment: [],
                    cw1155Payment: [],
                  }),
                ).finish(),
              },
            ] as any[],
          }),
        };
        const res = await onSign([intent, send, submit]);
        txHash = res?.transactionHash ?? '';
      } catch (err) {
        // The transaction did not go through: the PAY is still in the wallet.
        setStage('error');
        setError(payConvertErrorMessage(err));
        throw err;
      }

      setStage('confirming');
      const status = await awaitPayout(claimId);
      const settled = status?.stage === 'paid';
      const out: PayConvertResult = { claimId, txHash, settled, receiptCid: status?.receiptCid ?? null };
      if (status?.stage === 'rejected') {
        // The oracle refused the conversion (from this screen that means the PAY sent did not
        // match the amount claimed). Nothing was converted, and the oracle returns the PAY on
        // its own — say so, and say whether it has already landed.
        setStage('error');
        setError(rejectedMessage(status));
        setResult(out);
        return out;
      }
      if (status?.stage === 'failed') {
        setStage('error');
        setError(
          'We couldn’t finish checking this conversion. Your PAY is safe — if it isn’t back in your wallet within a few minutes, please contact support with your wallet address.',
        );
        setResult(out);
        return out;
      }
      setResult(out);
      setStage('done');
      return out;
    },
    [address, did, onSign, awaitPayout],
  );

  /** Ask again whether an unsettled conversion has landed. */
  const recheck = useCallback(async (): Promise<boolean> => {
    if (!result || result.settled) return true;
    const status = await fetchConvertStatus(result.claimId).catch(() => null);
    if (status?.stage === 'paid') {
      setResult({ ...result, settled: true, receiptCid: status.receiptCid });
      return true;
    }
    return false;
  }, [result]);

  return { stage, error, result, convert, recheck, reset };
}
