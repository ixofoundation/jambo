export const CHAINS = {
	'devnet-1': {
		chainId: 'devnet-1',
		chainName: 'ixo Devnet',
		rpc: 'https://devnet.ixo.earth/rpc/',
		rest: 'https://devnet.ixo.earth/rest/',
		bip44: {
			coinType: 118,
		},
		bech32Config: {
			bech32PrefixAccAddr: 'ixo',
			bech32PrefixAccPub: 'ixopub',
			bech32PrefixValAddr: 'ixovaloper',
			bech32PrefixValPub: 'ixovaloperpub',
			bech32PrefixConsAddr: 'ixovalcons',
			bech32PrefixConsPub: 'ixovalconspub',
		},
		currencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
				coinGeckoId: 'ixo',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
				coinGeckoId: 'ixo',
			},
		],
		stakeCurrency: {
			coinDenom: 'IXO',
			coinMinimalDenom: 'uixo',
			coinDecimals: 6,
			coinGeckoId: 'ixo',
		},
		coinType: 118,
		gasPriceStep: {
			low: 0.01,
			average: 0.025,
			high: 0.03,
		},
		features: ['stargate'],
	},
	'pandora-5': {
		chainId: 'pandora-5',
		chainName: 'ixo Testnet',
		rpc: 'https://testnet.ixo.earth/rpc/',
		rest: 'https://testnet.ixo.earth/rest/',
		bip44: {
			coinType: 118,
		},
		bech32Config: {
			bech32PrefixAccAddr: 'ixo',
			bech32PrefixAccPub: 'ixopub',
			bech32PrefixValAddr: 'ixovaloper',
			bech32PrefixValPub: 'ixovaloperpub',
			bech32PrefixConsAddr: 'ixovalcons',
			bech32PrefixConsPub: 'ixovalconspub',
		},
		currencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
				coinGeckoId: 'ixo',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
				coinGeckoId: 'ixo',
			},
		],
		stakeCurrency: {
			coinDenom: 'IXO',
			coinMinimalDenom: 'uixo',
			coinDecimals: 6,
			coinGeckoId: 'ixo',
		},
		coinType: 118,
		gasPriceStep: {
			low: 0.01,
			average: 0.025,
			high: 0.03,
		},
		features: ['stargate'],
	},
	'impacthub-3': {
		chainId: 'impacthub-3',
		chainName: 'Impact Hub',
		rpc: 'https://impacthub.ixo.world/rpc/',
		rest: 'https://impacthub.ixo.world/rest/',
		bip44: {
			coinType: 118,
		},
		bech32Config: {
			bech32PrefixAccAddr: 'ixo',
			bech32PrefixAccPub: 'ixopub',
			bech32PrefixValAddr: 'ixovaloper',
			bech32PrefixValPub: 'ixovaloperpub',
			bech32PrefixConsAddr: 'ixovalcons',
			bech32PrefixConsPub: 'ixovalconspub',
		},
		currencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
				coinGeckoId: 'ixo',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
				coinGeckoId: 'ixo',
			},
		],
		stakeCurrency: {
			coinDenom: 'IXO',
			coinMinimalDenom: 'uixo',
			coinDecimals: 6,
			coinGeckoId: 'ixo',
		},
		coinType: 118,
		gasPriceStep: {
			low: 0.01,
			average: 0.025,
			high: 0.03,
		},
		features: ['stargate'],
	},
};

export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? Object.keys(CHAINS)[0];
export const BLOCKCHAIN_REST_URL = CHAINS[CHAIN_ID].rest as string;
export const BLOCKCHAIN_RPC_URL = CHAINS[CHAIN_ID].rpc as string;
