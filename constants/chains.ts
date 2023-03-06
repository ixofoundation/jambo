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

export const DefaultChainName =
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_NAME ?? (ChainNames.includes('impacthub') ? 'impacthub' : '');

export const EnableDeveloperMode = !!process.env.NEXT_PUBLIC_ENABLE_DEVELOPER_MODE;

export const DefaultChainNetwork =
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_DEFAULT_CHAIN_NETWORK
    : EnableDeveloperMode
    ? 'testnet'
    : 'mainnet';
