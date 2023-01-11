import { createSigningClient, SigningStargateClient, cosmos } from '@ixo/impactxclient-sdk';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';

import { BLOCKCHAIN_RPC_URL } from '@constants/chains';
import { TRX_FEE, TRX_MSG } from 'types/transactions';

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

export const generateBankSendTrx = ({
	fromAddress,
	toAddress,
	denom,
	amount,
}: {
	fromAddress: string;
	toAddress: string;
	denom: string;
	amount: string;
}): TRX_MSG => ({
	typeUrl: '/cosmos.bank.v1beta1.MsgSend',
	value: cosmos.bank.v1beta1.MsgSend.fromPartial({
		fromAddress,
		toAddress,
		amount: [cosmos.base.v1beta1.Coin.fromPartial({ amount, denom })],
	}),
});

export const generateDelegateTrx = ({
	delegatorAddress,
	validatorAddress,
	denom,
	amount,
}: {
	delegatorAddress: string;
	validatorAddress: string;
	denom: string;
	amount: string;
}): TRX_MSG => ({
	typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
	value: cosmos.staking.v1beta1.MsgDelegate.fromPartial({
		delegatorAddress,
		validatorAddress,
		amount: cosmos.base.v1beta1.Coin.fromPartial({ amount, denom }),
	}),
});

export const generateUndelegateTrx = ({
	delegatorAddress,
	validatorAddress,
	denom,
	amount,
}: {
	delegatorAddress: string;
	validatorAddress: string;
	denom: string;
	amount: string;
}): TRX_MSG => ({
	typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
	value: cosmos.staking.v1beta1.MsgUndelegate.fromPartial({
		delegatorAddress,
		validatorAddress,
		amount: cosmos.base.v1beta1.Coin.fromPartial({ amount, denom }),
	}),
});

export const generateRedelegateTrx = ({
	delegatorAddress,
	validatorSrcAddress,
	validatorDstAddress,
	denom,
	amount,
}: {
	delegatorAddress: string;
	validatorSrcAddress: string;
	validatorDstAddress: string;
	denom: string;
	amount: string;
}): TRX_MSG => ({
	typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
	value: cosmos.staking.v1beta1.MsgBeginRedelegate.fromPartial({
		delegatorAddress,
		validatorSrcAddress,
		validatorDstAddress,
		amount: cosmos.base.v1beta1.Coin.fromPartial({ amount, denom }),
	}),
});

export const generateWithdrawRewardTrx = ({
	delegatorAddress,
	validatorAddress,
}: {
	delegatorAddress: string;
	validatorAddress: string;
}): TRX_MSG => ({
	typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
	value: cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward.fromPartial({
		delegatorAddress,
		validatorAddress,
	}),
});
