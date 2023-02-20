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

// Example of send action
// {
// 	"id": "send_abc",
// 	"steps": [
// 		{
// 			"id": "get_receiver_address",
// 			"name": "Get receiver address"
// 		},
// 		{
// 			"id": "select_token_and_amount",
// 			"name": "Select token and amount"
// 		},
// 		{
// 			"id": "bank_MsgSend",
// 			"name": "Review and sign"
// 		}
// 	],
// 	"name": "Send",
// 	"description": "Send tokens",
// 	"image": "send_abc.png"
// }

// Example of delegate action
// {
// 	"id": "delegate_abc",
// 	"steps": [
// 		{
// 			"id": "get_validator_delegate",
// 			"name": "Get validator address"
// 		},
// 		{
// 			"id": "select_amount_delegate",
// 			"name": "Define amount to delegate"
// 		},
// 		{
// 			"id": "staking_MsgDelegate",
// 			"name": "Review and sign"
// 		}
// 	],
// 	"name": "Delegate",
// 	"description": "Delegate tokens",
// 	"image": "delegate_abc.png"
// },

// Example of undelegate action
// {
// 	"id": "undelegate_abc",
// 	"steps": [
// 		{
// 			"id": "get_delegated_validator_undelegate",
// 			"name": "Get delegation validator address"
// 		},
// 		{
// 			"id": "select_amount_undelegate",
// 			"name": "Define amount to undelegate"
// 		},
// 		{
// 			"id": "staking_MsgUndelegate",
// 			"name": "Review and sign"
// 		}
// 	],
// 	"name": "Undelegate",
// 	"description": "Undelegate tokens",
// 	"image": "undelegate_abc.png"
// },

// Example of redelegate action
// {
// 	"id": "redelegate_abc",
// 	"steps": [
// 		{
// 			"id": "get_delegated_validator_redelegate",
// 			"name": "Get delegation validator address"
// 		},
// 		{
// 			"id": "select_amount_redelegate",
// 			"name": "Define amount to redelegate"
// 		},
// 		{
// 			"id": "get_validator_redelegate",
// 			"name": "Get validator address"
// 		},
// 		{
// 			"id": "staking_MsgRedelegate",
// 			"name": "Review and sign"
// 		}
// 	],
// 	"name": "Redelegate",
// 	"description": "Redelegate tokens",
// 	"image": "redelegate_abc.png"
// },

// Example of claim rewards action
// {
// 	"id": "claim_rewards_abc",
// 	"steps": [
// 		{
// 			"id": "distribution_MsgWithdrawDelegatorReward",
// 			"name": "Review and sign"
// 		}
// 	],
// 	"name": "Claim Rewards",
// 	"description": "Claim rewards on your delegations",
// 	"image": "claim_rewards_abc.png"
// }
