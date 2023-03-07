import { STEPS } from 'types/steps';

export const VALIDATOR_CONFIGS = {
  [STEPS.get_validator_delegate]: {
    delegatedValidatorsOnly: false,
    showValidatorDetails: true,
    requireFunds: true,
    allowFilters: true,
    label: 'Choose a Validator for your Delegation',
  },
  [STEPS.get_delegated_validator_undelegate]: {
    delegatedValidatorsOnly: true,
    showValidatorDetails: false,
    label: 'Choose validator',
  },
  [STEPS.get_delegated_validator_redelegate]: {
    delegatedValidatorsOnly: true,
    showValidatorDetails: false,
    label: 'Choose the Validator to redelegate from',
  },
  [STEPS.get_validator_redelegate]: {
    delegatedValidatorsOnly: false,
    showValidatorDetails: false,
    allowFilters: true,
    label: 'Choose validator to redelegate to',
  },
  default: {
    delegatedValidatorsOnly: false,
    showValidatorDetails: true,
    requireFunds: true,
    allowFilters: true,
    label: 'Choose a Validator',
  },
};

export const VALIDATOR_AMOUNT_CONFIGS = {
  [STEPS.select_amount_delegate]: {
    defaultLabel: 'Enter an Amount to Delegate',
    label: 'Enter amount to delegate',
    sub: 'Your tokens will be locked for 21 days.',
    source: 'wallet',
  },
  [STEPS.select_amount_undelegate]: {
    defaultLabel: 'Enter amount to undelegate',
    label: 'Enter amount to undelegate',
    sub: 'Your tokens will be available after 21 days.',
    source: 'validator',
  },
  [STEPS.select_amount_redelegate]: {
    defaultLabel: 'Enter amount to redelegate',
    label: 'Enter amount to redelegate',
    sub: 'Your tokens will be redelegated instantly and you continue to earn staking rewards.',
    source: 'validator',
  },
  default: {
    defaultLabel: 'Enter amount',
    label: 'Enter amount',
    source: 'wallet',
  },
};
