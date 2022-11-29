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
