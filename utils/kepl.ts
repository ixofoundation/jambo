import { CHAINS, CHAIN_ID } from '@constants/chains';
import { Keplr } from '@keplr-wallet/types';
import { USER } from 'types/user';

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
