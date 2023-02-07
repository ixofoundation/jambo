import { ChangeEvent, FC } from 'react';

import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import ValidatorFilter from '@components/ValidatorFilter/ValidatorFilter';
import Loader from '@components/Loader/Loader';
import { VALIDATOR, VALIDATOR_FILTER_TYPE } from 'types/validators';
import useGlobalValidators from '@hooks/globalValidators';

type ValidatorListProps = {
	label: string;
	allowFilters: boolean;
	excludeValidators: string[];
	delegatedValidatorsOnly: boolean;
	onValidatorClick: (validator: VALIDATOR) => () => void;
	exclude?: string[];
};

const ValidatorList: FC<ValidatorListProps> = ({
	label,
	allowFilters,
	excludeValidators = [],
	delegatedValidatorsOnly,
	onValidatorClick,
}) => {
	const { validators, filterValidators, validatorsLoading, searchFilter, sortFilter } = useGlobalValidators({
		delegatedValidatorsOnly,
		customFilter: (validator) => !excludeValidators.includes(validator.address),
	});

	const handleFilterChange = (filterType: VALIDATOR_FILTER_TYPE) => (event: any) => {
		event?.preventDefault();
		filterValidators('sort', filterType);
	};

	const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
		event?.preventDefault();
		filterValidators('search', event.target.value);
	};

	if (validatorsLoading) return <Loader />;

	// if (!validators?.length) return null;

	return (
		<>
			<p>{label}</p>
			{allowFilters && (
				<ValidatorFilter
					sortFilter={sortFilter}
					searchFilter={searchFilter}
					onSortChange={handleFilterChange}
					onSearchChange={handleSearchChange}
				/>
			)}
			{validators?.map((validator: VALIDATOR) => {
				return <ValidatorListItem key={validator.address} validator={validator} onClick={onValidatorClick} />;
			})}
		</>
	);
};

export default ValidatorList;
