import { USER } from './user';

export enum WALLET_TYPE {
	keysafe = 'keysafe',
	keplr = 'keplr',
}

export type WALLET = {
	walletType?: WALLET_TYPE;
	user?: USER;
};
