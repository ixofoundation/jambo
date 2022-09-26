import { BLOCKCHAIN_GRPC_REST_URL, BLOCKCHAIN_REST_URL, CHAIN_ID } from '@constants/chains';
import axios from 'axios';

import { TRX_FEE, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { WALLET } from 'types/wallet';
import blocksyncApi from './blocksync';
import { generateKeysafeTx, sortObject } from './transactions';
import * as Toast from '@components/toast/toast';

export const getKeysafe = (): any => {
	if (typeof window !== 'undefined' && window['ixoKs']) {
		const IxoInpageProvider = window['ixoKs'];
		const ixoInpageProvider = new IxoInpageProvider();

		if (ixoInpageProvider) return ixoInpageProvider;
	}

	return undefined;
};

export const initializeKeysafe = async (wallet: WALLET): Promise<USER | undefined> => {
	const keysafe = getKeysafe();
	const user = await new Promise<USER | undefined>(resolve => {
		keysafe.getInfo(async (error: any, response: any) => {
			if (response) {
				// console.log({ response });
				let baseUser = { name: response.name, pubKey: response.didDoc.pubKey, address: '', didDoc: response.didDoc, ledgered: false };

				try {
					const getDidDoc = await blocksyncApi.user.getDidDoc(response.didDoc.did);
					// console.log({ getDidDoc });
					if (!(getDidDoc as any)?.error) baseUser.ledgered = true;

					// if (wallet.user?.pubKey !== baseUser.pubKey || wallet.user?.ledgered !== baseUser.ledgered || wallet.user?.accountNumber == undefined || wallet.user?.address == undefined) {
					const addressResponse = await axios.get(`${BLOCKCHAIN_REST_URL}/pubKeyToAddr/${response.didDoc.pubKey}`);
					// console.log({ addressResponse });
					const address = addressResponse.data.result;

					const accountResponse = await axios.get(`${BLOCKCHAIN_REST_URL}/auth/accounts/${address}`);
					console.log({ accountResponse });

					// let account = accountResponse.data?.result?.value?.base_vesting_account?.base_account;
					// if (account) {
					// 	resolve({ ...baseUser, address: account.address, sequence: account.sequence, accountNumber: account.account_number ?? account.accountNumber });
					// }

					let account = accountResponse.data.result.value;
					resolve({ ...baseUser, address: account.address, sequence: account.sequence, accountNumber: account.account_number ?? account.accountNumber });
					// }
					resolve(wallet.user);
				} catch (error) {
					console.log('Error blocksyncApi.user.getDidDoc: ' + error);
				}
			}
			resolve(undefined);
		});
	});
	return user;
};

export const keysafeBroadCastMessage = (user: USER, msgs: TRX_MSG[], memo = '', fee: TRX_FEE): Promise<string | null> =>
	new Promise(resolve => {
		const payload = {
			msgs,
			chain_id: CHAIN_ID,
			fee,
			memo,
			account_number: String(user.accountNumber),
			sequence: String(user.sequence),
		};

		const trx_fail = () => {
			Toast.errorToast(`Transaction Failed`);
			resolve(null);
		};

		const keysafe = getKeysafe();
		keysafe.requestSigning(
			JSON.stringify(sortObject(payload)),
			(error: any, signature: any) => {
				if (error) trx_fail();
				axios
					.post(`${BLOCKCHAIN_GRPC_REST_URL}/cosmos/tx/v1beta1/txs`, {
						tx: generateKeysafeTx(payload.msgs, signature, payload.account_number, payload.sequence),
						mode: 'BROADCAST_MODE_SYNC',
					})
					.then(response => {
						if (response.data.txhash) {
							if (response.data.code === 4) return trx_fail();
							Toast.successToast(`Transaction Successful`);
							resolve(response.data.txhash);
						}
						trx_fail();
					})
					.catch(() => {
						trx_fail();
					});
			},
			'base64',
		);
	});
