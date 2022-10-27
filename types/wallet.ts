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
};
