import { BLOCKCHAIN_RPC_URL } from '@constants/chains';
import { assertIsDeliverTxSuccess, SigningStargateClient } from '@cosmjs/stargate';
import { SigningStargateClient as CustomSigningStargateClient } from '@client-sdk/utils/customClient';
import { Registry } from '@cosmjs/proto-signing';
import { TRX_FEE, TRX_MSG } from 'types/transactions';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { Coin } from '@client-sdk/codec/cosmos/coin';
import { MsgDelegate } from '@client-sdk/codec/external/cosmos/staking/v1beta1/tx';

export const initStargateClient = async (offlineSigner: any, endpoint?: string): Promise<SigningStargateClient> => {
	const registry = new Registry(defaultStargateTypes);
	// registry.register('/cosmos.bank.v1beta1.MsgSend', MsgSend);

	const cosmJS: SigningStargateClient = await SigningStargateClient.connectWithSigner(endpoint || BLOCKCHAIN_RPC_URL, offlineSigner, { registry: registry });

	return cosmJS;
};

export const sendTransaction = async (
	client: SigningStargateClient | CustomSigningStargateClient,
	delegatorAddress: string,
	payload: {
		msgs: TRX_MSG[];
		chain_id: string;
		fee: TRX_FEE;
		memo: string;
	},
): Promise<any> => {
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
	value: MsgSend.fromPartial({
		fromAddress,
		toAddress,
		amount: [Coin.fromPartial({ amount, denom })],
	}),
});

export const generateDelegateTrx = ({ delegatorAddress, validatorAddress, denom, amount }: { delegatorAddress: string; validatorAddress: string; denom: string; amount: string }): TRX_MSG => ({
	typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
	value: MsgDelegate.fromPartial({
		delegatorAddress,
		validatorAddress,
		amount: Coin.fromPartial({ amount, denom }),
	}),
});
