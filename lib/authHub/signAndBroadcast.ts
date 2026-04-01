import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { createSigningClient, createQueryClient, createRegistry, ixo } from '@ixo/impactxclient-sdk';
import { assertIsDeliverTxSuccess, GasPrice, StdFee } from '@cosmjs/stargate';
import Long from 'long';

import { CHAIN_RPC_URL } from '@constants/common';
import { SessionKeySigner } from './sessionSigner';

type SignAndBroadcastParams = {
  address: string;
  messages: any[];
  sessionMnemonic: string;
  sessionAuthenticatorId: string;
  feegrantGranter?: string;
  memo?: string;
};

/**
 * Find a valid feegrant granter for the given address.
 */
async function findFeegrantGranter(userAddress: string): Promise<string | undefined> {
  try {
    const queryClient = await createQueryClient(CHAIN_RPC_URL);
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

const calculateGasFee = (messageCount: number): StdFee => {
  const gasUsed = messageCount * 250000;
  const gas = gasUsed * 1.7;
  const gasPriceStep = 0.035;
  const feeAmount = Math.round(gas * gasPriceStep);
  return {
    amount: [{ denom: 'uixo', amount: String(feeAmount) }],
    gas: String(Math.round(gas)),
  };
};

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
}: SignAndBroadcastParams) {
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

  // Calculate fee (chain can't simulate with nonCriticalExtensionOptions)
  let fee: StdFee = calculateGasFee(messages.length);

  // Check for feegrant if not already provided
  const granter = feegrantGranter ?? (await findFeegrantGranter(address));
  if (granter) {
    fee = { ...fee, granter };
  }

  // Sign with session key and broadcast — pass txBodyBytes with TxExtension, messages empty
  const result = await client.signAndBroadcast(address, [], fee, memo, undefined, txBodyBytes);
  assertIsDeliverTxSuccess(result);
  return result;
}
