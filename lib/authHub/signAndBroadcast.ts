import { pubkeyType } from '@cosmjs/amino';
import { DirectSecp256k1HdWallet, encodePubkey, makeAuthInfoBytes } from '@cosmjs/proto-signing';
import { toBase64, toHex } from '@cosmjs/encoding';
import { cosmos, createSigningClient, createQueryClient, createRegistry, ixo } from '@ixo/impactxclient-sdk';
import { assertIsDeliverTxSuccess, BroadcastTxError, DeliverTxResponse, GasPrice, StdFee } from '@cosmjs/stargate';
import Long from 'long';

import { CHAIN_RPC_URL } from '@constants/common';
import { fallbackGas, feeForGas, gasFromSimulation } from './gasFee';
import { SessionKeySigner } from './sessionSigner';

type QueryClient = Awaited<ReturnType<typeof createQueryClient>>;

type SignAndBroadcastParams = {
  address: string;
  messages: any[];
  sessionMnemonic: string;
  sessionAuthenticatorId: string;
  feegrantGranter?: string;
  memo?: string;
  /**
   * Gas limit to use ONLY if simulating the transaction fails (the limit is
   * normally the simulated gas plus headroom). Without it the fallback is a
   * fixed estimate per message. The fee follows from the limit at the app's
   * gas price either way.
   */
  gas?: number;
  /**
   * Called with the tx hash (upper-case hex of sha256(TxRaw bytes)) once the tx
   * is signed and BEFORE it is broadcast, so a caller can remember it first: a
   * reload, a closed tab or a lost connection during the inclusion wait can
   * then never leave a broadcast transfer unknown. If it throws, nothing is
   * broadcast.
   */
  onSigned?: (txHash: string) => void | Promise<void>;
};

/**
 * Where a failed sign-and-broadcast left the money:
 *  - `not_sent`: refused before or at broadcast (signing failed, or CheckTx
 *    rejected it) — nothing moved;
 *  - `failed_on_chain`: included in a block with a non-zero code — nothing moved
 *    (except the network fee);
 *  - `maybe_sent`: accepted for broadcast, but inclusion could not be confirmed
 *    (timeout, RPC error while waiting) — it may still go through.
 * `message` is the underlying error's, so callers that only read it are unaffected.
 */
export type BroadcastStage = 'not_sent' | 'failed_on_chain' | 'maybe_sent';

export class SignBroadcastError extends Error {
  readonly stage: BroadcastStage;
  /** Known once the tx was signed. */
  readonly txHash: string | null;
  /** The underlying error (cosmjs / signer). */
  readonly original: unknown;

  constructor(stage: BroadcastStage, txHash: string | null, original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    Object.setPrototypeOf(this, SignBroadcastError.prototype);
    this.name = 'SignBroadcastError';
    this.stage = stage;
    this.txHash = txHash;
    this.original = original;
  }
}

/** The Tendermint tx hash: sha256 of the encoded TxRaw, upper-case hex. Web Crypto (browsers, Node ≥ 18). */
export async function txHashOf(txBytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available to compute the transaction hash');
  const digest = await subtle.digest('SHA-256', txBytes);
  return toHex(new Uint8Array(digest)).toUpperCase();
}

/**
 * Find a valid feegrant granter for the given address.
 */
async function findFeegrantGranter(queryClient: QueryClient | null, userAddress: string): Promise<string | undefined> {
  if (!queryClient) return undefined;
  try {
    const resp = await queryClient.cosmos.feegrant.v1beta1.allowances({
      grantee: userAddress,
    });
    const grants = resp?.allowances;
    if (!grants?.length) return undefined;

    const registry = createRegistry();

    for (const grant of grants) {
      if (!grant.allowance || !grant.granter) continue;
      try {
        const decoded = registry.decode(grant.allowance);
        const expiration = decoded.expiration || decoded.basic?.expiration;
        if (expiration) {
          const expMs =
            typeof expiration === 'number'
              ? expiration
              : (expiration.seconds?.toNumber?.() || Number(expiration.seconds)) * 1000;
          if (expMs < Date.now()) continue;
        }
        const spendLimit = decoded.spendLimit || decoded.basic?.spendLimit;
        if (spendLimit && Array.isArray(spendLimit)) {
          const ixoLimit = spendLimit.find((c: any) => c.denom === 'uixo');
          if (ixoLimit && Number(ixoLimit.amount) <= 500) continue;
        }
        return grant.granter;
      } catch {
        continue;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** The part of the query client the simulation uses (exported for the tests). */
export type TxSimulator = {
  cosmos: { tx: { v1beta1: { simulate: QueryClient['cosmos']['tx']['v1beta1']['simulate'] } } };
};

/**
 * Simulate the EXACT transaction about to be signed — the encoded TxBody with
 * the smart-account TxExtension, the session signer's pubkey and the account's
 * sequence, an empty signature — and return the gas it used. The SDK's own
 * `simulate` re-encodes the messages into a plain TxBody, which drops the
 * TxExtension, so the request is built here from the body bytes. The chain's
 * authenticators skip signature checks under simulation but still charge for
 * them, so the figure includes the authenticator's own cost.
 */
export async function simulateGas(
  queryClient: TxSimulator,
  signer: Pick<SessionKeySigner, 'getAccounts'>,
  txBodyBytes: Uint8Array,
  sequence: number,
): Promise<number> {
  const [account] = await signer.getAccounts();
  const pubkey = encodePubkey({ type: pubkeyType.secp256k1, value: toBase64(account.pubkey) });
  const authInfoBytes = makeAuthInfoBytes([{ pubkey, sequence }], [], 0, undefined, undefined);
  const txBytes = cosmos.tx.v1beta1.TxRaw.encode(
    cosmos.tx.v1beta1.TxRaw.fromPartial({ bodyBytes: txBodyBytes, authInfoBytes, signatures: [new Uint8Array()] }),
  ).finish();
  const { gasInfo } = await queryClient.cosmos.tx.v1beta1.simulate({ txBytes });
  if (!gasInfo) throw new Error('Simulation returned no gas info');
  return Long.fromValue(gasInfo.gasUsed).toNumber();
}

/**
 * The fee for the transaction: from a simulation of it when the chain answers,
 * else (no query client, the simulation failed, or it reported nothing) from
 * the caller's limit or the fixed per-message estimate.
 */
export async function estimateFee(
  queryClient: TxSimulator | null,
  signer: Pick<SessionKeySigner, 'getAccounts'>,
  txBodyBytes: Uint8Array,
  sequence: number,
  messageCount: number,
  gasLimit?: number,
): Promise<StdFee> {
  try {
    if (!queryClient) throw new Error('No query client');
    const gasUsed = await simulateGas(queryClient, signer, txBodyBytes, sequence);
    return feeForGas(gasFromSimulation(gasUsed));
  } catch (err) {
    console.warn('signAndBroadcast: gas simulation failed, using the fixed estimate', err);
    return feeForGas(fallbackGas(messageCount, gasLimit));
  }
}

/**
 * Sign and broadcast a transaction using a session key mnemonic.
 * Uses the smart account TxExtension to select the session authenticator.
 */
export async function signAndBroadcastWithSessionKey({
  address,
  messages,
  sessionMnemonic,
  sessionAuthenticatorId,
  feegrantGranter,
  memo = '',
  gas,
  onSigned,
}: SignAndBroadcastParams): Promise<DeliverTxResponse> {
  const sessionWallet = await DirectSecp256k1HdWallet.fromMnemonic(sessionMnemonic, { prefix: 'ixo' });
  const signer = new SessionKeySigner(sessionWallet, address);

  const client = await createSigningClient(CHAIN_RPC_URL, signer as any, false, {
    gasPrice: GasPrice.fromString('0.025uixo'),
  });

  const sigAuthId = Long.fromString(sessionAuthenticatorId);

  // Encode TxBody with smart account TxExtension in nonCriticalExtensionOptions
  const txBodyBytes = client.registry.encodeTxBody({
    messages,
    memo,
    nonCriticalExtensionOptions: [
      {
        typeUrl: '/ixo.smartaccount.v1beta1.TxExtension',
        value: ixo.smartaccount.v1beta1.TxExtension.encode({
          selectedAuthenticators: messages.map(() => sigAuthId),
        }).finish(),
      },
    ],
  });

  // Sign with the session key (txBodyBytes carry the TxExtension; messages empty), hash, let
  // the caller remember the hash, THEN broadcast — the same steps as the client's own
  // signAndBroadcast, split so nothing is broadcast before the hash is known.
  let txHash: string | null = null;
  let txBytes: Uint8Array;
  try {
    // The signer data is fetched once, so the simulation and the signature share one sequence.
    // Without a query client (RPC down) the tx is still signed, on the fallback gas and without
    // a granter — as before the simulation.
    const [{ accountNumber, sequence }, chainId, queryClient] = await Promise.all([
      client.getSequence(address),
      client.getChainId(),
      createQueryClient(CHAIN_RPC_URL).catch((err): null => {
        console.warn('signAndBroadcast: no query client, skipping simulation and feegrant lookup', err);
        return null;
      }),
    ]);
    const [simulated, granter] = await Promise.all([
      estimateFee(queryClient, signer, txBodyBytes, sequence, messages.length, gas),
      feegrantGranter ?? findFeegrantGranter(queryClient, address),
    ]);
    const fee: StdFee = granter ? { ...simulated, granter } : simulated;

    const txRaw = await client.sign(address, [], fee, memo, { accountNumber, sequence, chainId }, txBodyBytes);
    txBytes = cosmos.tx.v1beta1.TxRaw.encode(txRaw).finish();
    txHash = await txHashOf(txBytes);
    if (onSigned) await onSigned(txHash);
  } catch (err) {
    throw new SignBroadcastError('not_sent', txHash, err);
  }

  let result: DeliverTxResponse;
  try {
    result = await client.broadcastTx(txBytes, client.broadcastTimeoutMs, client.broadcastPollIntervalMs);
  } catch (err) {
    // CheckTx refused it (BroadcastTxError): never entered the mempool. Anything else (the
    // inclusion wait timed out, the RPC failed while polling) may still land.
    throw new SignBroadcastError(err instanceof BroadcastTxError ? 'not_sent' : 'maybe_sent', txHash, err);
  }
  try {
    assertIsDeliverTxSuccess(result);
  } catch (err) {
    throw new SignBroadcastError('failed_on_chain', txHash, err);
  }
  return result;
}
