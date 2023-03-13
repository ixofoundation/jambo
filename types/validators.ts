import { CURRENCY, CURRENCY_TOKEN } from './wallet';

export type VALIDATOR_FILTER_TYPE = 'voting_asc' | 'voting_desc' | 'commission_asc' | 'commission_desc';

export type DELEGATION_REWARD = {
  validatorAddress: string;
  rewards?: CURRENCY_TOKEN;
};

export type DELEGATION_REWARDS = {
  total?: CURRENCY_TOKEN;
  rewards: DELEGATION_REWARD[];
};

export type DELEGATION = {
  delegatorAddress: string;
  validatorAddress: string;
  shares: number;
  balance: CURRENCY_TOKEN;
};

export type UNBONDING_DELEGATION = {
  delegatorAddress: string;
  validatorAddress: string;
  entries: {
    balance: CURRENCY_TOKEN;
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
  rewards?: CURRENCY;
};

export type VALIDATOR_CONFIG = {
  delegatedValidatorsOnly: boolean;
  showValidatorDetails: boolean;
  allowFilters?: boolean;
  requireFunds?: boolean;
  label: string;
};

export type VALIDATOR_AMOUNT_CONFIG = {
  defaultLabel: string;
  label: string;
  sub?: string;
  source: 'wallet' | 'validator';
};

export type VALIDATORS_AVATARS = {
  [validatorAddress: string]: string;
};
