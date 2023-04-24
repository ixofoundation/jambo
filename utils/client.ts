import { createSigningClient, SigningStargateClient, cosmos } from '@ixo/impactxclient-sdk';
// import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';

import { TRX_FEE, TRX_FEE_OPTION, TRX_FEE_OPTIONS, TRX_MSG } from 'types/transactions';
import { EncodeObject } from '@cosmjs/proto-signing';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';

export const initStargateClient = async (endpoint: string, offlineSigner: any): Promise<SigningStargateClient> => {
  const cosmJS = await createSigningClient(endpoint, offlineSigner);
  return cosmJS;
};

export const calculateGasOptions = (gasUsed: number): TRX_FEE_OPTIONS => {
  const gasPriceStep = {
    low: 0.010001,
    average: 0.025005,
    high: 0.030003,
  };
  const gas = gasUsed < 0.01 ? 0.01 : gasUsed;
  const gasOptions = {
    low: gas * gasPriceStep.low,
    average: gas * gasPriceStep.average,
    high: gas * gasPriceStep.high,
  };

  return gasOptions;
};

export const sendTransaction = async (
  client: SigningStargateClient,
  delegatorAddress: string,
  payload: {
    msgs: TRX_MSG[];
    chain_id: string;
    memo: string;
    fee: TRX_FEE_OPTION;
    feeDenom: string;
  },
): Promise<any> => {
  try {
    const gasUsed =
      payload.feeDenom === 'uixo'
        ? 500000
        : await client.simulate(delegatorAddress, payload.msgs as EncodeObject[], payload.memo);
    const gas = gasUsed * 1.3;
    const gasOptions = calculateGasOptions(gas);
    const fee: TRX_FEE = {
      amount: [
        {
          denom: payload.feeDenom,
          amount: String(Math.round(gasOptions[payload.fee || 'average'])),
        },
      ],
      gas: String(Math.round(gas)),
    };
    const result = await client.signAndBroadcast(delegatorAddress, payload.msgs as any, fee, payload.memo);
    console.log('sendTransaction::result', result);
    assertIsDeliverTxSuccess(result);
    return result;
  } catch (e) {
    console.error('sendTransaction', e);
    throw e;
  }
};
