type RefineFunction = (str: string) => string;

const csvToArray = (csv: string = '', refine: RefineFunction = (x) => x) => {
	const arr = csv
		.split(',')
		.filter((x) => x)
		.map(refine);
	return [...new Set(arr)];
};

export const ChainNames = csvToArray(process.env.NEXT_PUBLIC_CHAIN_NAMES, (str) =>
	str
		?.replace(/testnet|devnet/i, '')
		?.trim()
		?.toLowerCase(),
);
export const ChainNetworks = csvToArray(process.env.NEXT_PUBLIC_CHAIN_NETWORKS);
export const DefaultChainId = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID;
export const EnableMainnet = !!process.env.NEXT_PUBLIC_ENABLE_MAINNET;
export const EnableTestnet = !!process.env.NEXT_PUBLIC_ENABLE_TESTNET;
export const DefaultNetwork = process.env.NEXT_PUBLIC_DEFAULT_NETWORK || 'testnet';
export const MainnetAndTestnet = !!EnableMainnet && !!EnableTestnet;
