import { getKeplrChainInfo } from '@ixo/cosmos-chain-resolver';

import { CHAIN_INFO_REQUEST, CHAIN_NETWORK_TYPE, KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import {
  ChainNames,
  DefaultChainName,
  EnableDeveloperMode,
  EnableLocalChainMode,
  getLocalChainInfo,
} from '@constants/chains';
import { isFulfilled } from './misc';

async function fetchChainInfo(chainName: string, chainNetwork: CHAIN_NETWORK_TYPE): Promise<CHAIN_INFO_REQUEST> {
  let chainInfo: KEPLR_CHAIN_INFO_TYPE | undefined;
  try {
    chainInfo = await getKeplrChainInfo(chainName, chainNetwork);
  } catch (error) {
    if (chainNetwork !== 'devnet') console.error(`${chainName} ${chainNetwork} chain::${error}`);
    if (chainNetwork === 'devnet') console.warn(`${chainName} ${chainNetwork} chain::${error}`);
    if (chainNetwork !== 'devnet') throw error;
  }
  return { chainName, chainNetwork, chainInfo: chainInfo ? { ...chainInfo, chainNetwork } : chainInfo };
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
  // const rejectedResponses = responses.filter(isRejected).map(({ reason }) => reason);
  return EnableLocalChainMode ? getLocalChainInfo() : fulfilledResponses.filter((x) => x.chainInfo);
};

export const getChainsByNetwork = (chains: CHAIN_INFO_REQUEST[], chainNetwork: CHAIN_NETWORK_TYPE) =>
  chains.filter((chain) =>
    chainNetwork === 'testnet'
      ? chain.chainNetwork === chainNetwork || chain.chainNetwork === 'devnet'
      : chain.chainNetwork === chainNetwork,
  );

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
