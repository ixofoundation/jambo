import { CHAINS, CHAIN_ID } from '@constants/chains';
import { Keplr } from '@keplr-wallet/types';
import { USER } from 'types/user';
import { TRX_FEE, TRX_MSG } from 'types/transactions';

import * as Toast from '@components/toast/toast';
import { sendTransaction, initStargateClient } from './client';

export const getKeplr = (): Keplr | undefined => {
	if (typeof window !== 'undefined' && window.keplr) return window.keplr;
	return undefined;
};

export const initializeKeplr = async (): Promise<USER | undefined> => {
	const keplr = getKeplr();
	try {
		await keplr?.experimentalSuggestChain(CHAINS[CHAIN_ID]);
		await keplr?.enable(CHAIN_ID);
		const key = await keplr?.getKey(CHAIN_ID);
		return key ? { name: key.name, pubKey: key.pubKey, address: key.bech32Address, algo: key.algo, ledgered: true } : undefined;
	} catch (error) {
		console.error('Error initializing Kepl: ' + error);
	}
	return;
};

export const connectKeplrAccount = async (): Promise<any> => {
	const keplr = getKeplr();
	if (!keplr) return [null, null];

	await keplr.experimentalSuggestChain(CHAINS[CHAIN_ID]);
	await keplr.enable(CHAIN_ID);

	const offlineSigner = keplr.getOfflineSigner(CHAIN_ID);
	const accounts = await offlineSigner.getAccounts();
	return [accounts, offlineSigner];
};

export const keplrBroadCastMessage = async (msgs: TRX_MSG[], memo = '', fee: TRX_FEE): Promise<string | null> => {
	const trx_fail = () => {
		Toast.errorToast(`Transaction Failed`);
		return null;
	};

	const [accounts, offlineSigner] = await connectKeplrAccount();
	if (!accounts || !offlineSigner) return trx_fail();
	const address = accounts[0].address;
	const client = await initStargateClient(offlineSigner);

	const payload = {
		msgs,
		chain_id: CHAIN_ID,
		fee,
		memo,
	};

	try {
		const result = await sendTransaction(client, address, payload);
		if (result) {
			Toast.successToast(`Transaction Successful`);
			return result.transactionHash;
		} else {
			throw 'transaction failed';
		}
	} catch (e) {
		return trx_fail();
	}
};
