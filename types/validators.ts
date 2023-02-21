import { CURRENCY } from './wallet';

export type VALIDATOR_FILTER_TYPE = 'voting_asc' | 'voting_desc' | 'commission_asc' | 'commission_desc';

export type DELEGATION_REWARD = {
	validatorAddress: string;
	rewards: CURRENCY[];
};

export type DELEGATION_REWARDS = {
	total: CURRENCY[];
	rewards: DELEGATION_REWARD[];
};

export type DELEGATION = {
	delegatorAddress: string;
	validatorAddress: string;
	shares: number;
	balance: CURRENCY;
};

export type UNBONDING_DELEGATION = {
	delegatorAddress: string;
	validatorAddress: string;
	entries: {
		balance: number;
		completionTime: number;
	}[];
};

export type VALIDATOR = {
	address: string;
	moniker: string;
	identity: string;
	avatarUrl?: string;
	description?: string;
	commission: number;
	votingPower: number;
	votingRank: number;
	delegation?: DELEGATION;
	rewards?: CURRENCY[];
};

export type VALIDATOR_CONFIG = {
	delegatedValidatorsOnly: boolean;
	showValidatorDetails: boolean;
	allowFilters?: boolean;
	requireFunds?: boolean;
	pageTitle: string;
	label: string;
};

export type VALIDATOR_AMOUNT_CONFIG = {
	defaultLabel: string;
	label: string;
	sub?: string;
	pageTitle: string;
	source: 'wallet' | 'validator';
};
