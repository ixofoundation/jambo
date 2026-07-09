import { useCallback, useState } from 'react';

import { useAuth } from '@hooks/useAuth';
import {
  type OfframpCustomer,
  type OnrampQuoteResult,
  type OnrampSource,
  type OnrampTransaction,
  createOnramp,
  getOnramp,
  listOnramps,
  quoteOnramp,
} from 'lib/yellowcard/offrampClient';
import { mintOnrampBearer } from '@utils/ucanYellowcard';

/** In-flight stage of a deposit, for UI feedback. */
export type OnrampStage = 'idle' | 'authorizing' | 'creating' | 'submitted' | 'error';

export interface DepositParams {
  /** Local fiat the user will pay (YC locks the rate for ~10 min). */
  localAmount: number;
  currency: string;
  country: string;
  /** Payment rail (bank | momo). */
  channelType: string;
  source: OnrampSource;
  customer: OfframpCustomer;
  /** Where a hosted payment page (ZA) returns the user to. */
  returnUrl?: string;
  /** The user's KYC SD-JWT presentation — verified by the worker's gate. */
  kycCredential: string;
}

/**
 * YellowCard on-ramp orchestration for jambo. Far simpler than the off-ramp:
 * no signing and no Skip work happen client-side — the worker receives the
 * USDC on Base and bridges it to the user's ixo address itself. The frontend
 * only creates the collection and shows payment instructions + status.
 */
export default function useOnramp() {
  const { address, did } = useAuth();

  const [stage, setStage] = useState<OnrampStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<OnrampTransaction[]>([]);
  const [active, setActive] = useState<OnrampTransaction | null>(null);

  const mintBearer = useCallback(async (): Promise<string> => {
    if (!did) throw new Error('Not signed in');
    return mintOnrampBearer(did);
  }, [did]);

  const refreshTransactions = useCallback(async () => {
    const bearer = await mintBearer();
    const res = await listOnramps(bearer);
    setTransactions(res.transactions);
    return res.transactions;
  }, [mintBearer]);

  const previewDeposit = useCallback(
    async (params: {
      localAmount: number;
      currency: string;
      channelType: string;
      country: string;
    }): Promise<OnrampQuoteResult> => {
      const bearer = await mintBearer();
      return quoteOnramp(params, bearer);
    },
    [mintBearer],
  );

  /** Create the YC collection. The returned transaction carries the payment
   *  instructions (bank account + reference / payment link / momo prompt) and
   *  the EXACT USDC the user will receive — shown before they pay anything. */
  const deposit = useCallback(
    async (params: DepositParams): Promise<OnrampTransaction> => {
      if (!address) throw new Error('Wallet address not available');
      setError(null);
      try {
        setStage('authorizing');
        const bearer = await mintBearer();
        setStage('creating');
        const created = await createOnramp(
          {
            localAmount: params.localAmount,
            currency: params.currency,
            country: params.country,
            channelType: params.channelType,
            ixoAddress: address,
            source: params.source,
            customer: params.customer,
            returnUrl: params.returnUrl,
            kycCredential: params.kycCredential,
          },
          bearer,
        );
        setActive(created.transaction);
        setStage('submitted');
        await refreshTransactions().catch(() => undefined);
        return created.transaction;
      } catch (err) {
        setStage('error');
        setError(err instanceof Error ? err.message : 'Deposit failed');
        throw err;
      }
    },
    [address, mintBearer, refreshTransactions],
  );

  const pollTransaction = useCallback(
    async (id: string): Promise<OnrampTransaction> => {
      const bearer = await mintBearer();
      const res = await getOnramp(id, bearer);
      return res.transaction;
    },
    [mintBearer],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    stage,
    error,
    active,
    transactions,
    previewDeposit,
    deposit,
    refreshTransactions,
    pollTransaction,
    clearError,
  };
}
