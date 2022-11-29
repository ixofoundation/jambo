import { Currency } from './wallet';

export type DELEGATION = {
	delegatorAddress: string;
	validatorAddress: string;
	shares: number;
	balance: Currency;
};

export type VALIDATOR = {
	address: string;
	moniker: string;
	identity: string;
	avatarUrl: string | null;
	description: string;
	commission: number;
	votingPower: number;
	votingRank: number;
	delegation: DELEGATION | null;
};

export type ValidatorConfig = {
	delegatedValidatorsOnly: boolean;
	showValidatorDetails: boolean;
	allowFilters: boolean;
	pageTitle: string;
	label: string;
};

export type ValidatorAmountConfig = {
	defaultLabel: string;
	label: string;
	sub?: string;
	pageTitle: string;
	source: 'wallet' | 'validator';
};
