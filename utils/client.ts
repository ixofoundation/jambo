import { BLOCKCHAIN_RPC_URL, CHAINS, CHAIN_ID } from '@constants/chains';
import { Keplr } from '@keplr-wallet/types';
import { USER } from 'types/user';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { assertIsDeliverTxSuccess, SigningStargateClient } from '@cosmjs/stargate';
import { SigningStargateClient as CustomSigningStargateClient } from '@client-sdk/utils/customClient';
import { Registry } from '@cosmjs/proto-signing';
import { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { MsgVote, MsgSubmitProposal } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import { TextProposal } from 'cosmjs-types/cosmos/gov/v1beta1/gov';
import { MsgSend, MsgMultiSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { MsgDeposit } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import { MsgWithdrawDelegatorReward, MsgSetWithdrawAddress } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { TRX_FEE, TRX_MSG } from 'types/transactions';
// const { makeWallet, makeClient } = require('@ixo/client-sdk');
import { LegacyClient } from 'ixo/client-sdk/src';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';

import * as Toast from '@components/toast/toast';
import { accountFromAny } from '@client-sdk/utils/EdAccountHandler';

export const initStargateClient = async (offlineSigner: any): Promise<SigningStargateClient> => {
	const registry = new Registry(defaultStargateTypes);
	registry.register('/cosmos.bank.v1beta1.MsgSend', MsgSend);

	const cosmJS: SigningStargateClient = await SigningStargateClient.connectWithSigner(BLOCKCHAIN_RPC_URL, offlineSigner, { registry: registry });

	return cosmJS;
};

export const initCustomStargateClient = async (offlineSigner: any): Promise<CustomSigningStargateClient> => {
	const registry = new Registry(defaultStargateTypes);
	registry.register('/cosmos.bank.v1beta1.MsgSend', MsgSend);

	const cosmJS: CustomSigningStargateClient = await CustomSigningStargateClient.connectWithSigner(BLOCKCHAIN_RPC_URL, offlineSigner, { registry: registry, accountParser: accountFromAny });

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
		console.log('start sendTransaction');
		const result = await client.signAndBroadcast(delegatorAddress, payload.msgs as any, payload.fee, payload.memo);
		console.log({ result });
		// const result = await client.broadcastTx(Uint8Array.from(TxRaw.encode(signed).finish()));
		assertIsDeliverTxSuccess(result);
		return result;
	} catch (e) {
		console.error('sendTransaction', e);
		throw e;
	}
};
