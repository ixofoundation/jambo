import { DecCoin } from '@ixo/impactxclient-sdk/types/codegen/cosmos/base/v1beta1/coin';
import { USER } from './user';

export enum WALLET_TYPE {
	opera = 'opera',
	keplr = 'keplr',
	keysafe = 'keysafe',
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
	balances?: DecCoin[];
};
