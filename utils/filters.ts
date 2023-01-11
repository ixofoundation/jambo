import { VALIDATOR } from 'types/validators';
import { VALIDATOR_FILTER_KEYS } from 'constants/filters';

export const VALIDATOR_FILTERS = {
	[VALIDATOR_FILTER_KEYS.VOTING_ASC]: (a: VALIDATOR, b: VALIDATOR) =>
		!a.delegation !== !b.delegation
			? !a.delegation
				? 1
				: -1
			: a.votingPower !== b.votingPower
			? a.votingPower > b.votingPower
				? 1
				: -1
			: a.commission > b.commission
			? 1
			: -1,
	[VALIDATOR_FILTER_KEYS.VOTING_DESC]: (a: VALIDATOR, b: VALIDATOR) =>
		!a.delegation !== !b.delegation
			? !a.delegation
				? 1
				: -1
			: a.votingPower !== b.votingPower
			? a.votingPower > b.votingPower
				? -1
				: 1
			: a.commission > b.commission
			? -1
			: 1,
	[VALIDATOR_FILTER_KEYS.COMMISSION_ASC]: (a: VALIDATOR, b: VALIDATOR) =>
		!a.delegation !== !b.delegation
			? !a.delegation
				? 1
				: -1
			: a.commission !== b.commission
			? a.commission > b.commission
				? 1
				: -1
			: a.votingPower > b.votingPower
			? 1
			: -1,
	[VALIDATOR_FILTER_KEYS.COMMISSION_DESC]: (a: VALIDATOR, b: VALIDATOR) =>
		!a.delegation !== !b.delegation
			? !a.delegation
				? 1
				: -1
			: a.commission !== b.commission
			? a.commission > b.commission
				? -1
				: 1
			: a.votingPower > b.votingPower
			? -1
			: 1,
};

export const filterValidators = (validators: VALIDATOR[], filter: string, search: string) => {
	if (!validators?.length) {
		return validators;
	}

	let validatorsToFilter = validators;

	if (search?.length) {
		const searchTerm = search.toLowerCase();
		validatorsToFilter = validatorsToFilter.filter((validator) =>
			validator.moniker?.toLowerCase()?.includes(searchTerm),
		);
	}

	return validatorsToFilter.sort(VALIDATOR_FILTERS[filter]);
};
