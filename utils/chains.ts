import { AppCurrency, ChainInfo } from '@keplr-wallet/types';
import { customQueries } from '@ixo/impactxclient-sdk';

import { CHAIN_DROPDOWN_OPTION_TYPE, CHAIN_NETWORK_TYPE, KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { ChainNames } from '@constants/chains';

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

const fetchMainnetChain = async (chainName: string): Promise<KEPLR_CHAIN_INFO_TYPE> => {
	try {
		const chain = await customQueries.chain.getKeplrChainInfo(chainName, 'mainnet');
		return chain;
	} catch (error) {
		throw error;
	}
};
const fetchTestnetChain = async (chainName: string): Promise<KEPLR_CHAIN_INFO_TYPE | undefined> => {
	try {
		const chain = await customQueries.chain.getKeplrChainInfo(chainName, 'testnet');
		return chain;
	} catch (error) {
		console.error('fetch testnet chain::', error);
		return;
	}
};
const fetchDevnetChain = async (chainName: string): Promise<KEPLR_CHAIN_INFO_TYPE | undefined> => {
	try {
		const chain = await customQueries.chain.getKeplrChainInfo(chainName, 'devnet');
		return chain;
	} catch (error) {
		console.warn('fetch devnet chain::', error);
		return;
	}
};

export const getChainOptions = async (chainNetwork: CHAIN_NETWORK_TYPE = 'testnet') => {
	if (!ChainNames.length) throw new Error('Chain Names are required to continue');
	const chains = [];
	for (let chainName of ChainNames) {
		try {
			if (chainNetwork === 'mainnet') {
				const chainInfo = await fetchMainnetChain(chainName);
				chains.push(chainInfo);
			}
			if (chainNetwork === 'testnet') {
				const testnetChainInfo = await fetchTestnetChain(chainName);
				if (testnetChainInfo) chains.push(testnetChainInfo);
				const devnetChainInfo = await fetchDevnetChain(chainName);
				if (devnetChainInfo) chains.push(devnetChainInfo);
			}
		} catch (error) {
			console.error(chainName, chainNetwork, '::', error);
		}
	}
	return chains;
};

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
