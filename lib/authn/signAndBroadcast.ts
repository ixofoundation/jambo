import { createSigningClient, ixo } from '@ixo/impactxclient-sdk';
import Long from 'long';

import { SecpClient } from '@utils/secp';
import { CHAIN_RPC_URL } from '@constants/common';
import { PasskeyOfflineDirectSigner } from './PasskeyOfflineDirectSigner';
import { assertIsDeliverTxSuccess, GasPrice, StdFee } from '@cosmjs/stargate';
import { fido2 } from './client';

const calculateTrxGasOptions = (gasUsed: number) => {
  const gasPriceStep = {
    low: 0.02,
    average: 0.035,
    high: 0.045,
  };
  const gas = gasUsed < 0.01 ? 0.01 : gasUsed;
  const gasOptions = {
    low: gas * gasPriceStep.low,
    average: gas * gasPriceStep.average,
    high: gas * gasPriceStep.high,
  };

  return gasOptions;
};

type Props = {
  // wallet: SecpClient;
  address: string;
  messages: any[];
  credentialId: string;
  authenticatorId?: string;
  feegrantGranter?: string;
};

export async function signAndBroadcastWithPasskey({
  address,
  messages,
  credentialId,
  authenticatorId,
  feegrantGranter,
}: Props) {
  if (!authenticatorId) {
    throw new Error('Authenticator ID is required, please ensure to Login with Passkey before sending transactions');
  }
  if (credentialId === null || credentialId === undefined) {
    throw new Error('Credential ID is required, please ensure to Login with Passkey before sending transactions');
  }

  // create offline direct signer
  const offlineDirectSigner = new PasskeyOfflineDirectSigner({
    address: address,
    credentialId,
    credentialRequestOptions: await fido2.assertionOptions(),
  });

  // create signing client
  const client = await createSigningClient(
    CHAIN_RPC_URL,
    // @ts-ignore
    offlineDirectSigner,
    false,
    {
      gasPrice: GasPrice.fromString('0.025uixo'),
    },
    {
      getLocalData: async (k) => localStorage.getItem(k),
      setLocalData: (k, d) => localStorage.setItem(k, d),
    },
  );

  // Use the provided authenticatorId
  const sigAuthId = Long.fromString(authenticatorId);

  // Create sign doc manually as need to add nonCriticalExtensionOptions
  const txBodyBytes = client.registry.encodeTxBody({
    messages,
    memo: 'memo',
    nonCriticalExtensionOptions: [
      {
        typeUrl: '/ixo.smartaccount.v1beta1.TxExtension',
        value: ixo.smartaccount.v1beta1.TxExtension.encode({
          selectedAuthenticators: messages.map((_) => sigAuthId),
        }).finish(),
      },
    ],
  });
  const memo = 'Signing with Passkey Demo';
  console.log('getUsedFee', { feegrantGranter, address, messages, fee: 'auto', memo });
  // NOTE: must manually calculate simulated fee for now as chain cant handle simulations with nonCriticalExtensionOptions.
  // Don't pass txBodyBytes to getUsedFee, it will throw an error, only pass messages
  // usedFee already multiplies the simulated gas, if that too little then manually simulate and increase multiplier
  // const usedFee = await client.getUsedFee(feegrantGranter ?? address, [], 'auto', memo, txBodyBytes);
  const gasUsed = (messages ?? []).length * 250000;
  const gas = gasUsed * 1.7;
  const gasOptions = calculateTrxGasOptions(gas);
  const fee: StdFee = {
    amount: [
      {
        denom: 'uixo',
        amount: String(Math.round(gasOptions.average)),
      },
    ],
    gas: String(Math.round(gas)),
    granter: feegrantGranter,
  };
  // Sign and broadcast the transaction, passing txBodyBytes with nonCriticalExtensionOptions, messages can be empty
  const result = await client.signAndBroadcast(address, [], fee, memo, undefined, txBodyBytes);
  assertIsDeliverTxSuccess(result);
  return result;
}
