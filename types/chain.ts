import {
	ChainNetwork,
	KeplrChainInfo,
	RegistryChainInfo,
} from '@ixo/impactxclient-sdk/types/custom_queries/chain.types';

export type REGISTRY_CHAIN_INFO_TYPE = RegistryChainInfo;
export type KEPLR_CHAIN_INFO_TYPE = KeplrChainInfo;

export type CHAIN_NETWORK_TYPE = ChainNetwork;

export type CHAIN_DROPDOWN_OPTION_TYPE = {
	value: string;
	label: string;
	img: string;
};
