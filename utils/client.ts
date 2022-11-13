import { BLOCKCHAIN_REST_URL, BLOCKCHAIN_RPC_URL } from '@constants/chains';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import { TRX_FEE, TRX_MSG } from 'types/transactions';
import axios from 'axios';
import { apiCurrencyToCurrency } from './currency';
import { Currency } from 'types/wallet';
import { createSigningClient, SigningStargateClient, cosmos, ixo, utils } from '@ixo/impactxclient-sdk';

export const initStargateClient = async (offlineSigner: any, endpoint?: string): Promise<SigningStargateClient> => {
	const cosmJS = await createSigningClient(endpoint || BLOCKCHAIN_RPC_URL, offlineSigner);
	return cosmJS;
};

export const sendTransaction = async (
	client: SigningStargateClient,
	delegatorAddress: string,
	payload: {
		msgs: TRX_MSG[];
		chain_id: string;
		fee: TRX_FEE;
		memo: string;
	},
): Promise<any> => {
	// console.log({ client, delegatorAddress, payload });
	try {
		const result = await client.signAndBroadcast(delegatorAddress, payload.msgs as any, payload.fee, payload.memo);
		assertIsDeliverTxSuccess(result);
		return result;
	} catch (e) {
		console.error('sendTransaction', e);
		throw e;
	}
};

export const generateBankSendTrx = ({ fromAddress, toAddress, denom, amount }: { fromAddress: string; toAddress: string; denom: string; amount: string }): TRX_MSG => ({
	typeUrl: '/cosmos.bank.v1beta1.MsgSend',
	value: cosmos.bank.v1beta1.MsgSend.fromPartial({
		fromAddress,
		toAddress,
		amount: [cosmos.base.v1beta1.Coin.fromPartial({ amount, denom })],
	}),
});

export const generateDelegateTrx = ({ delegatorAddress, validatorAddress, denom, amount }: { delegatorAddress: string; validatorAddress: string; denom: string; amount: string }): TRX_MSG => ({
	typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
	value: cosmos.staking.v1beta1.MsgDelegate.fromPartial({
		delegatorAddress,
		validatorAddress,
		amount: cosmos.base.v1beta1.Coin.fromPartial({ amount, denom }),
	}),
});

export const getBalances = async (address: string): Promise<Currency[]> => {
	let balances = [];
	try {
		const res = await axios.get(BLOCKCHAIN_REST_URL + '/cosmos/bank/v1beta1/balances/' + address);
		balances = res.data.balances.map((coin: any) => apiCurrencyToCurrency(coin));
	} catch (error) {
		console.log('/cosmos/bank/v1beta1/balances/', error);
		throw error;
	}
	return balances;
};
