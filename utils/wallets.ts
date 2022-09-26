// A file to combine all wallet types methods into one callback function

import { USER } from 'types/user';
import { WALLET, WALLET_TYPE } from 'types/wallet';
import { initializeKeplr } from './kepl';
import { initializeKeysafe } from './keysafe';

export const initializeWallet = async (wallet: WALLET): Promise<USER | undefined> => {
	switch (wallet.walletType) {
		case WALLET_TYPE.keplr:
			return await initializeKeplr();
		case WALLET_TYPE.keysafe:
			return await initializeKeysafe(wallet);
		default:
			return;
	}
};
