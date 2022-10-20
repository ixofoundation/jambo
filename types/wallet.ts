import { ArrayElement } from './general';
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

export const ChainOptions = [
	{ value: 'ixo', label: 'IXO' },
	// { value: 'ixo1', label: 'IXO1' },
	// { value: 'ixo2', label: 'IXO2' },
];
export type ChainOptionType = ArrayElement<typeof ChainOptions> | null;
