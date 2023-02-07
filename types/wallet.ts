import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';
import { TOKEN_ASSET } from '@utils/currency';

import { USER } from './user';

export type CURRENCY = DecCoin;

export enum WALLET_TYPE {
	opera = 'opera',
	keplr = 'keplr',
	walletConnect = 'walletConnect',
}

export type WALLET = {
	walletType?: WALLET_TYPE;
	user?: USER;
	balances?: BALANCES;
};

export type BALANCES = {
	loading?: boolean;
	error?: string;
	balances?: WALLET_BALANCE[];
};

export type WALLET_BALANCE = {
	token?: TOKEN_ASSET;
} & CURRENCY;
