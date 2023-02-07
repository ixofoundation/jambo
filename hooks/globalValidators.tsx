import { useContext, useEffect, useState } from 'react';

import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { VALIDATOR, VALIDATOR_FILTER_TYPE } from 'types/validators';
import { filterValidators } from '@utils/filters';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';

type GlobalValidators = {
	search?: string;
	filter?: VALIDATOR_FILTER_TYPE;
	delegatedValidatorsOnly?: boolean;
	customFilter?: (validator: VALIDATOR) => boolean;
};
type GlobalValidatorsReturn = {
	searchFilter: string;
	sortFilter: VALIDATOR_FILTER_TYPE;
	validators: VALIDATOR[] | null;
	validatorsLoading: boolean;
	updateValidators: Function;
	filterValidators: (filterKey: FilterKey, filterValue?: FilterValue) => void;
};
type FilterKey = 'sort' | 'search';
type FilterValue = string;

const useGlobalValidators = ({
	search = '',
	delegatedValidatorsOnly = false,
	filter = FILTERS.VOTING_DESC as VALIDATOR_FILTER_TYPE,
	customFilter = (validator: VALIDATOR) => true,
}: GlobalValidators): GlobalValidatorsReturn => {
	const [validatorsData, setValidatorsData] = useState<VALIDATOR[]>([]);
	const [sortFilter, setSortFilter] = useState<VALIDATOR_FILTER_TYPE>(filter);
	const [searchFilter, setSearchFilter] = useState<string>(search);
	const [loading, setLoading] = useState<boolean>(true);
	const { updateValidators, validators } = useContext(WalletContext);
	const { queryClient } = useContext(ChainContext);

	useEffect(() => {
		if (queryClient) {
			setLoading(true);
			updateValidators();
		}
	}, [queryClient]);

	useEffect(() => {
		if (validators?.length) {
			let validatorList = delegatedValidatorsOnly
				? validators.filter((validator: VALIDATOR) => !!validator.delegation?.shares)
				: validators;
			validatorList = validatorList.filter(customFilter);
			validatorList = filterValidators(validatorList, sortFilter, searchFilter);
			setValidatorsData(validatorList);
			setLoading(false);
		}
	}, [validators, sortFilter, searchFilter]);

	const filterValidatorState = (filterKey: FilterKey, filterValue: FilterValue = '') => {
		if (filterKey === 'sort') setSortFilter(filterValue as VALIDATOR_FILTER_TYPE);
		else if (filterKey === 'search') setSearchFilter(filterValue);
		else console.error(`Incorrect filter key provided - ${filterKey}`);
	};

	return {
		validators: validators?.length ? validatorsData : null,
		filterValidators: filterValidatorState,
		validatorsLoading: loading,
		updateValidators,
		searchFilter,
		sortFilter,
	};
};

export default useGlobalValidators;
