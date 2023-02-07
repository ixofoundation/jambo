// A file to combine all wallet types methods into one callback function
import { ChainInfo } from '@keplr-wallet/types';

import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { WALLET, WALLET_TYPE } from 'types/wallet';
import { USER } from 'types/user';
import { initializeWC, WCBroadCastMessage } from './walletConnect';
import { initializeKeplr, keplrBroadCastMessage } from './keplr';
import { initializeOpera, operaBroadCastMessage } from './opera';
import { getFeeDenom, TOKEN_ASSET } from './currency';

export const initializeWallet = async (
	walletType: WALLET_TYPE | undefined,
	chain: KEPLR_CHAIN_INFO_TYPE,
): Promise<USER | undefined> => {
	if (!chain) return;
	switch (walletType) {
		case WALLET_TYPE.keplr:
			return await initializeKeplr(chain as ChainInfo);
		case WALLET_TYPE.opera:
			return await initializeOpera();
		case WALLET_TYPE.walletConnect:
			return await initializeWC(chain as ChainInfo);
		default:
			return;
	}
};

export const broadCastMessages = async (
	wallet: WALLET,
	msgs: TRX_MSG[],
	memo: string | undefined,
	fee: TRX_FEE_OPTION,
	suggestedFeeDenom: string,
	chain: KEPLR_CHAIN_INFO_TYPE,
): Promise<string | null> => {
	if (!chain) return null;
	const feeDenom = getFeeDenom(suggestedFeeDenom, chain.feeCurrencies as TOKEN_ASSET[]);
	switch (wallet.walletType) {
		case WALLET_TYPE.keplr:
			return await keplrBroadCastMessage(msgs, memo, fee, feeDenom, chain as ChainInfo);
		case WALLET_TYPE.opera:
			return await operaBroadCastMessage(msgs, memo, fee, feeDenom, chain as ChainInfo);
		case WALLET_TYPE.walletConnect:
			return await WCBroadCastMessage(msgs, memo, fee, feeDenom, chain as ChainInfo);
		default:
			return null;
	}
};
