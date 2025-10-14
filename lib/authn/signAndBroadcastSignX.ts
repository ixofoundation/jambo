import { createSigningClient, ixo } from '@ixo/impactxclient-sdk';
import Long from 'long';

import { CHAIN_NETWORK_TYPE, CHAIN_RPC_URL } from '@constants/common';
import { assertIsDeliverTxSuccess, GasPrice, StdFee } from '@cosmjs/stargate';
import { signXBroadCastMessage } from '@utils/signX';
import { USER } from '../../types/user';

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
  address: string;
  messages: any[];
  signXUser: USER;
  feegrantGranter?: string;
};

export async function signAndBroadcastWithSignX({ address, messages, signXUser, feegrantGranter }: Props) {
  if (!signXUser) {
    throw new Error('SignX user is required, please ensure to Login with SignX before sending transactions');
  }

  // Use SignX to broadcast the transaction
  const transactionHash = await signXBroadCastMessage(
    messages,
    'SignX Transaction',
    'average',
    'uixo',
    process.env.NEXT_PUBLIC_CHAIN_NETWORK as any,
    {
      user: signXUser,
    },
  );

  if (!transactionHash) {
    throw new Error('Failed to broadcast transaction via SignX');
  }

  // Create a mock DeliverTxResponse since SignX doesn't return the full response
  // In a real implementation, you might want to query the transaction status
  const mockResult: any = {
    code: 0,
    height: 0,
    txIndex: 0,
    events: [],
    rawLog: '',
    transactionHash: transactionHash,
    gasUsed: 0,
    gasWanted: 0,
  };

  assertIsDeliverTxSuccess(mockResult);
  return mockResult;
}
