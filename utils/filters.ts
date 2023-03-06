import { VALIDATOR, VALIDATOR_FILTER_TYPE } from 'types/validators';
import { VALIDATOR_FILTER_KEYS } from 'constants/filters';

export const VALIDATOR_FILTERS = {
  [VALIDATOR_FILTER_KEYS.VOTING_POWER_RANKING]: (a: VALIDATOR, b: VALIDATOR) =>
    a.votingPower !== b.votingPower ? b.votingPower - a.votingPower : b.commission - a.commission,
  [VALIDATOR_FILTER_KEYS.VOTING_ASC]: (a: VALIDATOR, b: VALIDATOR) =>
    !a.delegation !== !b.delegation
      ? !a.delegation
        ? 1
        : -1
      : a.votingRank !== b.votingRank
      ? b.votingRank - a.votingRank
      : a.commission - b.commission,
  [VALIDATOR_FILTER_KEYS.VOTING_DESC]: (a: VALIDATOR, b: VALIDATOR) =>
    !a.delegation !== !b.delegation
      ? !a.delegation
        ? 1
        : -1
      : a.votingRank !== b.votingRank
      ? a.votingRank - b.votingRank
      : b.commission - a.commission,
  [VALIDATOR_FILTER_KEYS.COMMISSION_ASC]: (a: VALIDATOR, b: VALIDATOR) =>
    !a.delegation !== !b.delegation
      ? !a.delegation
        ? 1
        : -1
      : a.commission !== b.commission
      ? a.commission - b.commission
      : b.votingRank - a.votingRank,
  [VALIDATOR_FILTER_KEYS.COMMISSION_DESC]: (a: VALIDATOR, b: VALIDATOR) =>
    !a.delegation !== !b.delegation
      ? !a.delegation
        ? 1
        : -1
      : a.commission !== b.commission
      ? b.commission - a.commission
      : a.votingRank - b.votingRank,
};

export const filterValidators = (validators: VALIDATOR[], filter: VALIDATOR_FILTER_TYPE, search: string) => {
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
