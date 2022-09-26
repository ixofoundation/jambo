import axios from 'axios';

import { USER } from 'types/user';
import { WALLET } from 'types/wallet';
import blocksyncApi from './blocksync';

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
				let baseUser = { name: response.name, pubKey: response.didDoc.pubKey, address: '', did: response.didDoc.did, ledgered: false };

				try {
					const getDidDoc = await blocksyncApi.user.getDidDoc(response.didDoc.did);
					// console.log({ getDidDoc });
					if (!(getDidDoc as any)?.error) baseUser.ledgered = true;

					if (wallet.user?.pubKey !== baseUser.pubKey || wallet.user?.ledgered !== baseUser.ledgered) {
						const addressResponse = await axios.get(`${process.env.NEXT_PUBLIC_GAIA_URL}/pubKeyToAddr/${response.didDoc.pubKey}`);
						// console.log({ addressResponse });
						const address = addressResponse.data.result;

						const accountResponse = await axios.get(`${process.env.NEXT_PUBLIC_GAIA_URL}/auth/accounts/${address}`);
						// console.log({ accountResponse });

						let account = accountResponse.data?.result?.value?.base_vesting_account?.base_account;
						if (account) {
							resolve({ ...baseUser, address: account.address, sequence: account.sequence, accountNumber: account.account_number ?? account.accountNumber });
						}

						account = accountResponse.data.result.value;
						resolve({ ...baseUser, address: account.address, sequence: account.sequence, accountNumber: account.account_number ?? account.accountNumber });
					}
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
