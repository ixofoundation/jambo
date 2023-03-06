import { createContext, useState, useEffect, HTMLAttributes, useRef } from 'react';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import Banner from '@components/Banner/Banner';
import {
  extractChainIdFromChainInfos,
  extractChainInfosFromChainState,
  getChainsByNetwork,
  getChainOptions,
  getChainInfoByChainId,
} from '@utils/chains';
import { CHAIN_INFO_REQUEST, CHAIN_NETWORK_TYPE, KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { QUERY_CLIENT } from 'types/query';
import { DefaultChainNetwork } from '@constants/chains';

type CHAIN_STATE_TYPE = {
  chainId: string;
  chainNetwork: CHAIN_NETWORK_TYPE;
  chainLoading: boolean;
};

const DEFAULT_CHAIN: CHAIN_STATE_TYPE = {
  chainId: '',
  chainNetwork: DefaultChainNetwork as CHAIN_NETWORK_TYPE,
  chainLoading: true,
};

export const ChainContext = createContext({
  chain: DEFAULT_CHAIN as CHAIN_STATE_TYPE,
  chainInfo: {} as KEPLR_CHAIN_INFO_TYPE | undefined,
  chains: [] as KEPLR_CHAIN_INFO_TYPE[],
  queryClient: undefined as QUERY_CLIENT | undefined,
  updateChainId: (selectedChainId: string) => {},
  updateChainNetwork: (selectedChainNetwork: CHAIN_NETWORK_TYPE) => {},
});

export const ChainProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [chains, setChains] = useState<CHAIN_INFO_REQUEST[]>([]);
  const [currentChain, setCurrentChain] = useState<CHAIN_STATE_TYPE>(DEFAULT_CHAIN);
  const queryClientRef = useRef<QUERY_CLIENT | undefined>();

  const updateCurrentChain = (newChain: any, override: boolean = false) => {
    if (override) setCurrentChain({ ...DEFAULT_CHAIN, ...newChain });
    else setCurrentChain((prevState) => ({ ...prevState, ...newChain }));
  };

  const fetchChainOptions = async () => {
    try {
      const results = await getChainOptions();
      setChains(results);
      const chainInfos = getChainsByNetwork(results, currentChain.chainNetwork);
      const nextChainId = extractChainIdFromChainInfos(chainInfos);
      updateCurrentChain({ chainId: nextChainId });
    } catch (error) {
      console.error(error);
    }
  };

  const initQueryClient = async () => {
    try {
      const chainInfo = getChainInfoByChainId(chains, currentChain.chainId);
      if (!chainInfo) throw new Error('Unable to create query client - no chain info');
      const queryClient = await createQueryClient(chainInfo.rpc);
      queryClientRef.current = queryClient;
    } catch (error) {
      if (queryClientRef.current) queryClientRef.current = undefined;
      console.error('initQueryClient::', error);
    }
    updateCurrentChain({ chainLoading: false });
  };

  const updateChainId = (selectedChainId: string) => {
    if (selectedChainId === currentChain.chainId) return;
    if (queryClientRef.current) queryClientRef.current = undefined;
    updateCurrentChain({ chainLoading: true, chainId: selectedChainId });
  };

  const updateChainNetwork = (selectedChainNetwork: CHAIN_NETWORK_TYPE) => {
    if (selectedChainNetwork === currentChain.chainNetwork) return;
    try {
      updateCurrentChain({ chainLoading: true });
      if (queryClientRef.current) queryClientRef.current = undefined;
      const chainInfos = getChainsByNetwork(chains, selectedChainNetwork);
      const nextChainId = extractChainIdFromChainInfos(chainInfos);
      updateCurrentChain({ chainId: nextChainId, chainNetwork: selectedChainNetwork });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchChainOptions();
  }, []);

  useEffect(() => {
    if (currentChain.chainId) initQueryClient();
  }, [currentChain.chainId]);

  const value = {
    chains: extractChainInfosFromChainState(getChainsByNetwork(chains, currentChain.chainNetwork)),
    chain: currentChain,
    chainInfo: getChainInfoByChainId(chains, currentChain.chainId),
    queryClient: queryClientRef.current,
    updateChainId,
    updateChainNetwork,
  };

  return (
    <ChainContext.Provider value={value}>
      {children}
      <Banner label='TEST' display={currentChain.chainNetwork !== 'mainnet'}></Banner>
    </ChainContext.Provider>
  );
};
