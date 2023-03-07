import { AppCurrency, ChainInfo } from '@keplr-wallet/types';
import { customQueries } from '@ixo/impactxclient-sdk';

import { CHAIN_DROPDOWN_OPTION_TYPE, CHAIN_INFO_REQUEST, CHAIN_NETWORK_TYPE, KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { ChainNames, DefaultChainName, EnableDeveloperMode } from '@constants/chains';
import { isFulfilled, isRejected } from './misc';

export type PeggedCurrency = AppCurrency & {
  originCurrency?: AppCurrency & {
    /** For assets that are pegged/stablecoins. */
    pegMechanism?: 'algorithmic' | 'collateralized' | 'hybrid';
  };
};

export interface ChainInfoWithExplorer extends ChainInfo {
  /** Formed as "https://explorer.com/{txHash}" */
  explorerUrlToTx: string;
  /** Add optional stable coin peg info to currencies. */
  currencies: Array<
    AppCurrency & {
      pegMechanism?: 'collateralized' | 'algorithmic' | 'hybrid';
    }
  >;
}

/** All currency attributes (stake and fee) are defined once in the `currencies` list.
 *  Maintains the option to skip this conversion and keep the verbose `ChainInfo` type.
 */
export type SimplifiedChainInfo = Omit<ChainInfoWithExplorer, 'stakeCurrency' | 'feeCurrencies'> & {
  currencies: Array<
    AppCurrency &
      PeggedCurrency & {
        isStakeCurrency?: boolean;
        isFeeCurrency?: boolean;
      }
  >;
};

/** Convert a less redundant chain info schema into one that is accepted by Keplr's suggestChain: `ChainInfo`. */
export function createKeplrChainInfos(chainInfo: SimplifiedChainInfo): ChainInfoWithExplorer {
  let feeCurrencies: AppCurrency[] = [];
  let stakeCurrency: AppCurrency | undefined;

  for (const currency of chainInfo.currencies) {
    if (currency.isFeeCurrency) {
      feeCurrencies.push(currency);
    }

    if (currency.isStakeCurrency && stakeCurrency === undefined) {
      stakeCurrency = currency;
    } else if (currency.isStakeCurrency) {
      throw new Error(`There cannot be more than one stake currency for ${chainInfo.chainName}`);
    }
  }

  if (stakeCurrency === undefined) {
    throw new Error(`Did not specify a stake currency for ${chainInfo.chainName}`);
  }

  if (feeCurrencies.length === 0) {
    throw new Error(`Did not specify any fee currencies for ${chainInfo.chainName}`);
  }

  return {
    ...chainInfo,
    stakeCurrency,
    feeCurrencies,
  };
}

async function fetchChainInfo(chainName: string, chainNetwork: CHAIN_NETWORK_TYPE): Promise<CHAIN_INFO_REQUEST> {
  let chainInfo: KEPLR_CHAIN_INFO_TYPE | undefined;
  try {
    chainInfo = await customQueries.chain.getKeplrChainInfo(chainName, chainNetwork);
  } catch (error) {
    if (chainNetwork !== 'devnet') console.error(`${chainName} ${chainNetwork} chain::${error}`);
    if (chainNetwork === 'devnet') console.warn(`${chainName} ${chainNetwork} chain::${error}`);
    if (chainNetwork !== 'devnet') throw error;
  }
  return { chainName, chainNetwork, chainInfo };
}

export const getChainOptions = async () => {
  if (!ChainNames.length) throw new Error('Chain Names are required to continue');
  const requests: Promise<CHAIN_INFO_REQUEST>[] = [];

  for (const chainName of ChainNames) {
    requests.push(fetchChainInfo(chainName, 'mainnet'));
    if (EnableDeveloperMode) {
      requests.push(fetchChainInfo(chainName, 'testnet'));
      requests.push(fetchChainInfo(chainName, 'devnet'));
    }
  }

  const responses = await Promise.allSettled(requests);
  const fulfilledResponses = responses.filter(isFulfilled).map(({ value }): CHAIN_INFO_REQUEST => value);
  const rejectedResponses = responses.filter(isRejected).map(({ reason }) => reason);
  return fulfilledResponses.filter((x) => x.chainInfo);
};

export const getChainsByNetwork = (chains: CHAIN_INFO_REQUEST[], chainNetwork: CHAIN_NETWORK_TYPE) =>
  chains.filter((chain) => chain.chainNetwork === chainNetwork);

export const getChainInfoByChainId = (chains: CHAIN_INFO_REQUEST[], chainId: string) =>
  chains.find((chain) => chain.chainInfo?.chainId === chainId)?.chainInfo;

export const extractChainInfosFromChainState = (chainState: CHAIN_INFO_REQUEST[]): KEPLR_CHAIN_INFO_TYPE[] =>
  chainState.map(({ chainInfo }) => chainInfo as KEPLR_CHAIN_INFO_TYPE);

export const extractChainIdFromChainInfos = (chains: CHAIN_INFO_REQUEST[] = []) =>
  (!!DefaultChainName && chains.find((chain) => chain.chainName === DefaultChainName)?.chainInfo?.chainId) ||
  chains[0].chainInfo?.chainId ||
  '';

export const extractStakingTokenDenomFromChainInfo = (chainInfo?: KEPLR_CHAIN_INFO_TYPE) =>
  chainInfo?.stakeCurrency.coinMinimalDenom ?? '';

export const getChainFromChains = (chains: KEPLR_CHAIN_INFO_TYPE[], chainId: string) =>
  chains.find((chain: KEPLR_CHAIN_INFO_TYPE) => chain.chainId === chainId);

export const getChainDropdownOption = (chainInfo: KEPLR_CHAIN_INFO_TYPE) => {
  if (!chainInfo) {
    console.error('Keplr chain info not available');
    return;
  }

  return {
    value: chainInfo.chainId,
    label: chainInfo.chainName,
    img: chainInfo.stakeCurrency?.coinImageUrl || chainInfo.chainSymbolImageUrl || 'https://app.osmosis.zone',
  };
};

export const getChainDropdownOptions = (chains: KEPLR_CHAIN_INFO_TYPE[]): CHAIN_DROPDOWN_OPTION_TYPE[] =>
  chains.map(getChainDropdownOption).filter((x) => !!x) as CHAIN_DROPDOWN_OPTION_TYPE[];
