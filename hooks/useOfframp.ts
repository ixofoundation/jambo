import { useCallback, useState } from 'react';

import { IXO_CHAIN_ID, OFFRAMP_DESTINATION } from '@constants/yellowcard';
import { useAuth } from '@hooks/useAuth';
import { type BridgeRoute, buildBridgeTx, getBridgeRoute, trackTx } from 'lib/skip/skipBridge';
import {
  type CreateResult,
  type OfframpCustomer,
  type OfframpDestination,
  type OfframpTransaction,
  type QuoteResult,
  createOfframp,
  fetchPaymentRecordPdf,
  getOfframp,
  listOfframps,
  notifyDeposit,
  quoteOfframp,
} from 'lib/yellowcard/offrampClient';
import { mintOfframpBearer } from '@utils/ucanYellowcard';

const USDC_DECIMALS = 6;

function toMicro(amount: number): string {
  return Math.floor(amount * 10 ** USDC_DECIMALS).toString();
}

/** The address to provide for a chain Skip lists in `requiredChainAddresses`.
 *  ixo USDC → Base only requires ixo + Base (CCTP routes through Noble without
 *  needing a Noble address). We provide only those two and THROW on anything
 *  else — if Skip starts requiring another hop, abort rather than guess an
 *  address. */
function addressForRequiredChain(chainId: string, ixoAddress: string, destinationAddress: string): string {
  if (chainId === OFFRAMP_DESTINATION.skipChainId) return destinationAddress;
  if (chainId === IXO_CHAIN_ID) return ixoAddress;
  throw new Error(
    `Skip route unexpectedly requires an address for chain "${chainId}" (expected only ${IXO_CHAIN_ID} + ${OFFRAMP_DESTINATION.skipChainId}). Aborting for safety.`,
  );
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
  /** The exact ixo USDC denom the user holds (Skip source asset). */
  sourceDenom?: string;
  customer: OfframpCustomer;
  destination: OfframpDestination;
  /** The user's KYC SD-JWT presentation — the worker verifies it against our
   *  oracle and binds it to the caller's DID before creating the payout. */
  kycCredential: string;
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
  const [transactions, setTransactions] = useState<OfframpTransaction[]>([]);
  const [active, setActive] = useState<CreateResult | null>(null);
  const [bridgeRoute, setBridgeRoute] = useState<BridgeRoute | null>(null);

  const mintBearer = useCallback(async (): Promise<string> => {
    if (!did) throw new Error('Not signed in');
    return mintOfframpBearer(did);
  }, [did]);

  const refreshTransactions = useCallback(async () => {
    const bearer = await mintBearer();
    const res = await listOfframps(bearer);
    setTransactions(res.transactions);
    return res.transactions;
  }, [mintBearer]);

  /** Price the Skip bridge (ixo→Base) — how much USDC survives the hop. */
  const quoteBridge = useCallback(
    async (amountUsdc: number, sourceDenom?: string): Promise<BridgeRoute> => {
      const r = await getBridgeRoute({ amountInMicro: toMicro(amountUsdc), sourceDenom });
      setBridgeRoute(r);
      return r;
    },
    [],
  );

  /** Build the Skip messages, broadcast the ixo tx via the session-key signer,
   *  then register it with Skip's relay. Returns the ixo source tx hash. */
  const sendBridge = useCallback(
    async (params: { amountUsdc: number; destinationAddress: string; sourceDenom?: string; route?: BridgeRoute }): Promise<string> => {
      if (!address) throw new Error('Wallet address not available');
      const amountInMicro = toMicro(params.amountUsdc);

      const r = params.route ?? (await quoteBridge(params.amountUsdc, params.sourceDenom));
      const chainIdsToAddresses: Record<string, string> = {};
      for (const chainId of r.requiredChainAddresses) {
        chainIdsToAddresses[chainId] = addressForRequiredChain(chainId, address, params.destinationAddress);
      }

      const { chainId, msgs } = await buildBridgeTx({ amountInMicro, sourceDenom: params.sourceDenom, chainIdsToAddresses });

      // jambo's session-key signer wraps the messages with the smart-account
      // TxExtension and broadcasts; the auth provider shows the signing modal.
      const result = await onSign(msgs);
      const hash = result?.transactionHash;
      if (!hash) throw new Error('No transaction hash returned from signing');

      await trackTx(chainId, hash).catch(() => undefined);
      return hash;
    },
    [address, onSign, quoteBridge],
  );

  /** Preview a withdrawal end-to-end: price the bridge, then quote YC on the
   *  amount that actually arrives so `fiatReceived` is net of both fees. */
  const previewWithdrawal = useCallback(
    async (params: { amountUsdc: number; currency: string; channelType: string; country: string; sourceDenom?: string }): Promise<WithdrawalPreview> => {
      const route = await quoteBridge(params.amountUsdc, params.sourceDenom);
      const bridgedUsdc = Number(route.amountOutMicro) / 1e6;
      const skipFeeUsd =
        route.usdAmountIn != null && route.usdAmountOut != null
          ? Math.max(0, Number(route.usdAmountIn) - Number(route.usdAmountOut))
          : Math.max(0, params.amountUsdc - bridgedUsdc);
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
   *  1. authorize (UCAN) + create the YC sell → get the crypto deposit address;
   *  2. bridge the user's ixo USDC to that address via Skip (user signs);
   *  3. notify the worker of the source tx so it can track to completion.
   */
  const withdraw = useCallback(
    async (params: WithdrawParams): Promise<CreateResult> => {
      setError(null);
      try {
        setStage('authorizing');
        const createBearer = await mintBearer();

        // Re-price the Skip bridge NOW so the YC sell is created for the amount
        // that will ACTUALLY arrive. The same route is reused for the broadcast
        // below — no drift between what YC expects and what we send.
        setStage('creating');
        const route = await quoteBridge(params.amountUsdc, params.sourceDenom);
        const arrivingUsdc = Number(route.amountOutMicro) / 1e6;
        const skipFeeUsd =
          route.usdAmountIn != null && route.usdAmountOut != null
            ? Math.max(0, Number(route.usdAmountIn) - Number(route.usdAmountOut))
            : Math.max(0, params.amountUsdc - arrivingUsdc);

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
            kycCredential: params.kycCredential,
          },
          createBearer,
        );
        setActive(created);
        void refreshTransactions().catch(() => undefined);

        if (!created.deposit_address) {
          throw new Error('YellowCard did not return a deposit address for this sell. Check the worker logs.');
        }

        setStage('bridging');
        const sourceTxHash = await sendBridge({
          amountUsdc: params.amountUsdc,
          destinationAddress: created.deposit_address,
          sourceDenom: params.sourceDenom,
          route,
        });

        if (sourceTxHash) {
          setStage('notifying');
          const depositBearer = await mintBearer();
          await notifyDeposit(created.id, { skipTxHash: sourceTxHash, skipStatus: 'broadcast' }, depositBearer);
        }

        setStage('submitted');
        await refreshTransactions().catch(() => undefined);
        return created;
      } catch (err) {
        setStage('error');
        setError(err instanceof Error ? err.message : 'Withdrawal failed');
        throw err;
      }
    },
    [mintBearer, quoteBridge, sendBridge, refreshTransactions],
  );

  /** Re-run ONLY the bridge leg for an existing sell whose YC settlement is
   *  still open (deposit address unchanged), for when the first attempt was
   *  cancelled / failed before the crypto reached YellowCard. */
  const retryBridge = useCallback(
    async (tx: OfframpTransaction, sourceDenom?: string): Promise<void> => {
      if (!tx.deposit_address) throw new Error('No deposit address on this withdrawal.');
      const amountUsdc = tx.send_amount_usdc ?? tx.amount_usd;
      if (amountUsdc == null) throw new Error('Unknown send amount for this withdrawal.');
      setError(null);
      try {
        const route = await quoteBridge(amountUsdc, sourceDenom);
        const sourceTxHash = await sendBridge({ amountUsdc, destinationAddress: tx.deposit_address, sourceDenom, route });
        if (sourceTxHash) {
          const bearer = await mintBearer();
          await notifyDeposit(tx.id, { skipTxHash: sourceTxHash, skipStatus: 'broadcast' }, bearer);
        }
        await refreshTransactions().catch(() => undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Retry failed');
        throw err;
      }
    },
    [quoteBridge, sendBridge, mintBearer, refreshTransactions],
  );

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

  const clearError = useCallback(() => setError(null), []);

  return {
    stage,
    error,
    active,
    transactions,
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
