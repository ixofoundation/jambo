import { CHAIN_INFO_REQUEST } from 'types/chain';

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

export const LocalChainMode = Number(process.env.NEXT_PUBLIC_USE_LOCAL_BLOCKCHAIN_PORT || 0);
export const EnableLocalChainMode = !!LocalChainMode;

// helper to get chain info constant for when trying to test a local blockchain node
// replaces all 3 envirnoments with the local node so dont have to struggle with other env variables
export const getLocalChainInfo = (port = LocalChainMode): CHAIN_INFO_REQUEST[] => [
  {
    chainName: 'impacthub',
    chainNetwork: 'mainnet',
    chainInfo: {
      rpc: `http://localhost:${port}`,
      rest: 'https://lcd-ixo.keplr.app',
      chainId: 'ixo-5',
      chainName: 'ixo',
      chainSymbolImageUrl:
        'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
      stakeCurrency: {
        coinDenom: 'IXO',
        coinMinimalDenom: 'uixo',
        coinDecimals: 6,
        coinGeckoId: 'ixo',
        coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
        isStakeCurrency: true,
        isFeeCurrency: true,
      },
      walletUrl: 'https://wallet.keplr.app/chains/ixo',
      walletUrlForStaking: 'https://wallet.keplr.app/chains/ixo',
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
          coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
          isStakeCurrency: true,
          isFeeCurrency: true,
        },
      ],
      feeCurrencies: [
        {
          coinDenom: 'IXO',
          coinMinimalDenom: 'uixo',
          coinDecimals: 6,
          coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
          gasPriceStep: {
            low: 0.015,
            average: 0.025,
            high: 0.04,
          },
          isStakeCurrency: true,
          isFeeCurrency: true,
        },
      ],
      features: [],
      txExplorer: {
        name: 'Mintscan',
        txUrl: 'https://www.mintscan.io/ixo/txs/${txHash}',
      },
    },
  },
  {
    chainName: 'impacthub',
    chainNetwork: 'testnet',
    chainInfo: {
      rpc: `http://localhost:${port}`,
      rest: 'https://lcd-ixo.keplr.app',
      chainId: 'pandora-8',
      chainName: 'ixo',
      chainSymbolImageUrl:
        'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
      stakeCurrency: {
        coinDenom: 'IXO',
        coinMinimalDenom: 'uixo',
        coinDecimals: 6,
        coinGeckoId: 'ixo',
        coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
        isStakeCurrency: true,
        isFeeCurrency: true,
      },
      walletUrl: 'https://wallet.keplr.app/chains/ixo',
      walletUrlForStaking: 'https://wallet.keplr.app/chains/ixo',
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
          coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
          isStakeCurrency: true,
          isFeeCurrency: true,
        },
      ],
      feeCurrencies: [
        {
          coinDenom: 'IXO',
          coinMinimalDenom: 'uixo',
          coinDecimals: 6,
          coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
          gasPriceStep: {
            low: 0.015,
            average: 0.025,
            high: 0.04,
          },
          isStakeCurrency: true,
          isFeeCurrency: true,
        },
      ],
      features: [],
      txExplorer: {
        name: 'ixoworld',
        txUrl: 'https://blockscan-pandora.ixo.earth/transactions/${txHash}',
      },
    },
  },
  {
    chainName: 'impacthub',
    chainNetwork: 'devnet',
    chainInfo: {
      rpc: `http://localhost:${port}`,
      rest: 'https://lcd-ixo.keplr.app',
      chainId: 'devnet-1',
      chainName: 'ixo',
      chainSymbolImageUrl:
        'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
      stakeCurrency: {
        coinDenom: 'IXO',
        coinMinimalDenom: 'uixo',
        coinDecimals: 6,
        coinGeckoId: 'ixo',
        coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
        isStakeCurrency: true,
        isFeeCurrency: true,
      },
      walletUrl: 'https://wallet.keplr.app/chains/ixo',
      walletUrlForStaking: 'https://wallet.keplr.app/chains/ixo',
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
          coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
          isStakeCurrency: true,
          isFeeCurrency: true,
        },
      ],
      feeCurrencies: [
        {
          coinDenom: 'IXO',
          coinMinimalDenom: 'uixo',
          coinDecimals: 6,
          coinImageUrl: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/ixo/chain.png',
          gasPriceStep: {
            low: 0.015,
            average: 0.025,
            high: 0.04,
          },
          isStakeCurrency: true,
          isFeeCurrency: true,
        },
      ],
      features: [],
      txExplorer: {
        name: 'ixoworld',
        txUrl: 'https://devnet-blockscan.ixo.earth/transactions/${txHash}',
      },
    },
  },
];
