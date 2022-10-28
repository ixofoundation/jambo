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
		rpc: 'https://impacthub-rpc.lavenderfive.com/',
		// rpc: 'https://rpc-ixo-ia.cosmosia.notional.ventures/',
		// rpc: 'https://proxies.sifchain.finance/api/impacthub-3/rpc',
		// rpc: 'https://rpc-impacthub.keplr.app/', // CORS ERROR 404 ERROR
		// rpc: 'https://impacthub.ixo.world/rpc/',  // CORS ERROR
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

export const ASSETS = {
	$schema: '../assetlist.schema.json',
	chain_name: 'impacthub',
	assets: [
		{
			description: 'The native token of IXO Chain',
			denom_units: [
				{
					denom: 'uixo',
					exponent: 0,
				},
				{
					denom: 'ixo',
					exponent: 6,
				},
			],
			base: 'uixo',
			name: 'IXO',
			display: 'ixo',
			symbol: 'IXO',
			logo_URIs: {
				png: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/impacthub/images/ixo.png',
			},
			coingecko_id: 'ixo',
		},
	],
};

export const ChainDropdownOptions = [CHAINS[CHAIN_ID]].map((chain: any) => {
	const asset = ASSETS.assets.find((asset: any) => asset.coingecko_id === chain.stakeCurrency.coinGeckoId);

	return {
		value: chain.chainId,
		label: chain.chainName,
		img: Object.values(asset?.logo_URIs ?? {})[0],
	};
});

// {
//   "id": "eKXPPhewkJDLbE1bq1ibo8",
//   "steps": [
//     {
//       "id": "get_receiver_address",
//       "name": "Get receiver address"
//     },
//     {
//       "id": "select_token_and_amount",
//       "name": "Select token and amount"
//     },
//     {
//       "id": "review_and_sign",
//       "name": "Review and sign"
//     }
//   ],
//   "name": "Swap",
//   "description": "Swap flow",
//   "image": ""
// },
// {
//   "id": "eKXPPhewkJDLbE1bq1iboa",
//   "steps": [
//     {
//       "id": "get_validator_address",
//       "name": "Get validator address"
//     },
//     {
//       "id": "select_token_and_amount",
//       "name": "Select token and amount"
//     },
//     {
//       "id": "staking_MsgDelegate",
//       "name": "Review and sign"
//     }
//   ],
//   "name": "Stake",
//   "description": "Stake flow",
//   "image": ""
// }
