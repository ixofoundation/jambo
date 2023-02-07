import { createContext, useState, useEffect, HTMLAttributes, useRef } from 'react';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import Banner from '@components/Banner/Banner';
import { CHAIN_NETWORK_TYPE, KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { QUERY_CLIENT } from 'types/query';
import { DefaultChainId, DefaultNetwork } from '@constants/chains';
import { getChainFromChains, getChainOptions } from '@utils/chains';

type CHAIN_STATE_TYPE = {
	chainId: string;
	chainNetwork: CHAIN_NETWORK_TYPE;
	chainLoading: boolean;
	chainNetworkLoading: boolean;
};

const DEFAULT_CHAIN: CHAIN_STATE_TYPE = {
	chainId: '',
	chainNetwork: DefaultNetwork as CHAIN_NETWORK_TYPE,
	chainLoading: true,
	chainNetworkLoading: true,
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
	const [chains, setChains] = useState<KEPLR_CHAIN_INFO_TYPE[]>([]);
	const [currentChain, setCurrentChain] = useState<CHAIN_STATE_TYPE>(DEFAULT_CHAIN);

	const queryClientRef = useRef<QUERY_CLIENT | undefined>();

	const updateCurrentChain = (newChain: any, override: boolean = false) => {
		if (override) setCurrentChain({ ...DEFAULT_CHAIN, ...newChain });
		else setCurrentChain((prevState) => ({ ...prevState, ...newChain }));
	};

	const fetchChainOptions = async () => {
		try {
			const results = await getChainOptions(currentChain.chainNetwork);
			setChains(results);
			const defaultChainOption = getChainFromChains(results, DefaultChainId || results[0].chainId || '');
			updateCurrentChain({
				chainNetworkLoading: false,
				chainId: defaultChainOption?.chainId ?? results[0]?.chainId ?? '',
			});
		} catch (error) {
			console.error(error);
		}
	};

	const initQueryClient = async () => {
		try {
			const chainInfo = getChainFromChains(chains, currentChain.chainId);
			if (!chainInfo) throw new Error('Unable to create query client - no chain info');

			const queryClient = await createQueryClient(chainInfo.rpc);
			queryClientRef.current = queryClient;

			updateCurrentChain({ chainLoading: false });
		} catch (error) {
			if (queryClientRef.current) queryClientRef.current = undefined;
			console.error('initQueryClient::', error);
			updateCurrentChain({ chainLoading: false });
		}
	};

	const updateChainId = (selectedChainId: string) => {
		if (selectedChainId === currentChain.chainId) return;
		try {
			updateCurrentChain({ chainLoading: true, chainId: selectedChainId });
		} catch (error) {
			console.error('updateChainId::', error);
		}
	};

	const updateChainNetwork = (selectedChainNetwork: CHAIN_NETWORK_TYPE) => {
		if (selectedChainNetwork === currentChain.chainNetwork) return;
		try {
			updateCurrentChain({ chainNetworkLoading: true, chainLoading: true });
			if (queryClientRef.current) queryClientRef.current = undefined;
			updateCurrentChain({ chainId: '', chainNetwork: selectedChainNetwork });
		} catch (error) {
			console.error(error);
		}
	};

	useEffect(() => {
		fetchChainOptions();
	}, [currentChain.chainNetwork]);

	useEffect(() => {
		if (currentChain.chainId) initQueryClient();
	}, [currentChain.chainId]);

	const value = {
		chains,
		chain: currentChain,
		chainInfo: getChainFromChains(chains, currentChain.chainId),
		queryClient: queryClientRef.current,
		updateChainId,
		updateChainNetwork,
	};

	return (
		<ChainContext.Provider value={value}>
			{children}
			<Banner label="TEST" display={currentChain.chainNetwork !== 'mainnet'}></Banner>
		</ChainContext.Provider>
	);
};
