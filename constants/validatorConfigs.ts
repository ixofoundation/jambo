import { STEPS } from 'types/steps';

export const VALIDATOR_CONFIGS = {
	[STEPS.get_validator_address]: {
		pageTitle: 'Choose validator',
		delegatedValidatorsOnly: false,
		showValidatorDetails: true,
		allowFilters: true,
		label: 'Choose validator',
	},
	[STEPS.get_delegated_validator_undelegate]: {
		pageTitle: 'Undelegate',
		delegatedValidatorsOnly: true,
		showValidatorDetails: false,
		allowFilters: false,
		label: 'Choose validator',
	},
	[STEPS.get_delegated_validator_redelegate]: {
		pageTitle: 'Redelegate',
		delegatedValidatorsOnly: true,
		showValidatorDetails: false,
		allowFilters: false,
		label: 'Choose stake to redelegate',
	},
	[STEPS.get_validator_redelegate]: {
		pageTitle: 'Define validator to redelegate to',
		delegatedValidatorsOnly: false,
		showValidatorDetails: false,
		allowFilters: true,
		label: 'I want to redelegate to',
	},
	default: {
		pageTitle: 'Choose validator',
		delegatedValidatorsOnly: false,
		showValidatorDetails: true,
		allowFilters: true,
		label: 'Choose validator',
	},
};

export const VALIDATOR_AMOUNT_CONFIGS = {
	[STEPS.select_delegate_amount]: {
		pageTitle: 'Define amount to delegate',
		defaultLabel: 'Enter amount to delegate',
		label: 'I want to add',
		sub: 'Your tokens will be locked for 21 days.',
		source: 'wallet',
	},
	[STEPS.select_undelegate_amount]: {
		pageTitle: 'Define amount to undelegate',
		defaultLabel: 'Enter amount to undelegate',
		label: 'I want to undelegate',
		sub: 'Your tokens will be available after 21 days.',
		source: 'validator',
	},
	[STEPS.select_redelegate_amount]: {
		pageTitle: 'Define amount to redelegate',
		defaultLabel: 'Enter amount to undelegate',
		label: 'I want to redelegate',
		sub: 'Your tokens will be redelegated instantly.',
		source: 'validator',
	},
	default: {
		defaultLabel: 'Enter amount',
		label: 'Enter amount',
		source: 'wallet',
	},
};
