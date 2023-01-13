import { useContext, useEffect, useState } from 'react';

import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { filterValidators } from '@utils/filters';
import { WalletContext } from '@contexts/wallet';
import { VALIDATOR } from 'types/validators';

type GlobalValidators = {
	delegatedValidatorsOnly?: boolean;
	filter?: string;
	search?: string;
};
type GlobalValidatorsReturn = {
	sortFilter: string;
	searchFilter: string;
	validators: VALIDATOR[] | null;
	validatorsLoading: boolean;
	updateValidators: Function;
	filterValidators: (filterKey: FilterKey, filterValue?: FilterValue) => void;
};
type FilterKey = 'sort' | 'search';
type FilterValue = string;

const useGlobalValidators = ({
	delegatedValidatorsOnly = false,
	filter = FILTERS.VOTING_DESC,
	search = '',
}: GlobalValidators): GlobalValidatorsReturn => {
	const [validatorsData, setValidatorsData] = useState<VALIDATOR[]>([]);
	const [sortFilter, setSortFilter] = useState<string>(filter);
	const [loading, setLoading] = useState<boolean>(true);
	const [searchFilter, setSearchFilter] = useState<string>(search);
	const { updateValidators, validators } = useContext(WalletContext);

	useEffect(() => {
		updateValidators();
	}, []);

	useEffect(() => {
		if (validators?.length) {
			const validatorsData = delegatedValidatorsOnly
				? validators.filter((validator: VALIDATOR) => !!validator.delegation?.shares)
				: validators;
			setValidatorsData(filterValidators(validatorsData, sortFilter, searchFilter));
			setLoading(false);
		}
	}, [validators, sortFilter, searchFilter]);

	const filterValidatorState = (filterKey: FilterKey, filterValue: FilterValue = '') => {
		if (filterKey === 'sort') setSortFilter(filterValue);
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
