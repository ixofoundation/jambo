// A file to combine all wallet types methods into one callback function

import { TRX_FEE, TRX_MSG } from 'types/transactions';
import { USER } from 'types/user';
import { WALLET, WALLET_TYPE } from 'types/wallet';
import { initializeKeplr, keplrBroadCastMessage } from './keplr';
import { initializeKeysafe, keysafeBroadCastMessage } from './keysafe';
import { initializeOpera, operaBroadCastMessage } from './opera';
import { initializeWC, WCBroadCastMessage } from './walletConnect';

export const initializeWallet = async (wallet: WALLET): Promise<USER | undefined> => {
	switch (wallet.walletType) {
		case WALLET_TYPE.keplr:
			return await initializeKeplr();
		case WALLET_TYPE.keysafe:
			return await initializeKeysafe(wallet);
		case WALLET_TYPE.opera:
			return await initializeOpera();
		case WALLET_TYPE.walletConnect:
			return await initializeWC();
		default:
			return;
	}
};

export const broadCastMessages = async (wallet: WALLET, msgs: TRX_MSG[], memo: string | undefined, fee: TRX_FEE): Promise<string | null> => {
	switch (wallet.walletType) {
		case WALLET_TYPE.keplr:
			return await keplrBroadCastMessage(msgs, memo, fee);
		case WALLET_TYPE.keysafe:
			return await keysafeBroadCastMessage(wallet.user!, msgs, memo, fee);
		case WALLET_TYPE.opera:
			return await operaBroadCastMessage(wallet.user!, msgs, memo, fee);
		case WALLET_TYPE.walletConnect:
			return await WCBroadCastMessage(wallet.user!, msgs, memo, fee);
		default:
			return null;
	}
};
