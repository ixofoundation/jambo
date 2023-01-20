import { STEPS } from 'types/steps';

export const VALIDATOR_CONFIGS = {
	[STEPS.get_validator_delegate]: {
		pageTitle: 'Choose a Validator',
		delegatedValidatorsOnly: false,
		showValidatorDetails: true,
		requireFunds: true,
		allowFilters: true,
		label: 'Choose a Validator',
	},
	[STEPS.get_delegated_validator_undelegate]: {
		pageTitle: 'Undelegate',
		delegatedValidatorsOnly: true,
		showValidatorDetails: false,
		label: 'Choose a Validator',
	},
	[STEPS.get_delegated_validator_redelegate]: {
		pageTitle: 'Redelegate',
		delegatedValidatorsOnly: true,
		showValidatorDetails: false,
		label: 'Choose stake to redelegate',
	},
	[STEPS.get_validator_redelegate]: {
		pageTitle: 'Define validator to redelegate to',
		delegatedValidatorsOnly: false,
		showValidatorDetails: false,
		allowFilters: true,
		label: 'Choose validator to redelegate to',
	},
	default: {
		pageTitle: 'Choose a Validator',
		delegatedValidatorsOnly: false,
		showValidatorDetails: true,
		requireFunds: true,
		allowFilters: true,
		label: 'Choose a Validator',
	},
};

export const VALIDATOR_AMOUNT_CONFIGS = {
	[STEPS.select_delegate_amount]: {
		pageTitle: 'Define amount to delegate',
		defaultLabel: 'Enter an Amount to Delegate',
		label: 'Add',
		sub: 'Your tokens will be locked for 21 days.',
		source: 'wallet',
	},
	[STEPS.select_undelegate_amount]: {
		pageTitle: 'Define amount to undelegate',
		defaultLabel: 'Enter amount to undelegate',
		label: 'Enter amount to undelegate',
		sub: 'Your tokens will be available after 21 days.',
		source: 'validator',
	},
	[STEPS.select_redelegate_amount]: {
		pageTitle: 'Define amount to redelegate',
		defaultLabel: 'Enter amount to redelegate',
		label: 'Enter amount to redelegate',
		sub: 'Your tokens will be redelegated instantly.',
		source: 'validator',
	},
	default: {
		defaultLabel: 'Enter amount',
		label: 'Enter amount',
		source: 'wallet',
	},
};
