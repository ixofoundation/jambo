import { AccountData, OfflineSigner } from '@cosmjs/proto-signing';
import { assertIsDeliverTxSuccess, DeliverTxResponse, StdFee } from '@cosmjs/stargate';
import { createSigningClient } from '@ixo/impactxclient-sdk';

import { CHAIN_RPC_URL } from '@constants/common';

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

/**
 * Signs and broadcasts a transaction with a mnemonic
 * @param offlineSigner - The offline signer
 * @param messages - The messages to sign and broadcast
 * @param memo - The memo for the transaction
 * @param feegrantGranter - The granter for the transaction
 * @returns The deliver tx response
 */
export const signAndBroadcastWithMnemonic = async ({
  offlineSigner,
  messages,
  memo = 'Signing with Mnemonic Demo',
  feegrantGranter,
}: {
  offlineSigner: OfflineSigner;
  messages: any[];
  memo?: string;
  feegrantGranter?: string;
}): Promise<DeliverTxResponse> => {
  const signingClient = await createSigningClient(CHAIN_RPC_URL, offlineSigner);
  const accounts = await offlineSigner.getAccounts();
  const { address } = (accounts[0] ?? {}) as AccountData;

  const simGas = await signingClient.simulate(address, messages, memo);
  const gasUsed = simGas > 50000 ? simGas : (messages ?? []).length * 500000;
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
  const result = await signingClient.signAndBroadcast(address, messages, fee, memo, undefined);
  assertIsDeliverTxSuccess(result);
  return result;
};
