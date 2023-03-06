import { ChangeEvent, FC } from 'react';

import styles from './ValidatorFilter.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import InputWithSuffixIcon from '@components/InputWithSuffixIcon/InputWithSuffixIcon';
import FilterDesc from '@icons/filter_desc.svg';
import FilterAsc from '@icons/filter_asc.svg';
import Search from '@icons/search.svg';
import { VALIDATOR_FILTER_KEYS as FILTERS } from '@constants/filters';
import { VALIDATOR_FILTER_TYPE } from 'types/validators';

type ValidatorFilterProps = {
  sortFilter: VALIDATOR_FILTER_TYPE;
  searchFilter: string;
  onSortChange: (filterType: VALIDATOR_FILTER_TYPE) => (event: any) => void;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const ValidatorFilter: FC<ValidatorFilterProps> = ({ sortFilter, searchFilter, onSortChange, onSearchChange }) => {
  return (
    <>
      <InputWithSuffixIcon name='address' onChange={onSearchChange} value={searchFilter} icon={Search} />

      <div className={utilsStyles.spacer3} />

      <div className={styles.filtersWrapper}>
        <button
          className={`${styles.filterButton} ${
            sortFilter === FILTERS.VOTING_ASC || sortFilter === FILTERS.VOTING_DESC ? styles.activeFilterButton : ''
          }`}
          onClick={onSortChange(
            (sortFilter === FILTERS.VOTING_DESC ? FILTERS.VOTING_ASC : FILTERS.VOTING_DESC) as VALIDATOR_FILTER_TYPE,
          )}
        >
          Voting power {sortFilter === FILTERS.VOTING_ASC ? <FilterAsc /> : <FilterDesc />}
        </button>
        <button
          className={`${styles.filterButton} ${
            sortFilter === FILTERS.COMMISSION_ASC || sortFilter === FILTERS.COMMISSION_DESC
              ? styles.activeFilterButton
              : ''
          }`}
          onClick={onSortChange(
            (sortFilter === FILTERS.COMMISSION_DESC
              ? FILTERS.COMMISSION_ASC
              : FILTERS.COMMISSION_DESC) as VALIDATOR_FILTER_TYPE,
          )}
        >
          Commission {sortFilter === FILTERS.COMMISSION_ASC ? <FilterAsc /> : <FilterDesc />}
        </button>
      </div>
    </>
  );
};

export default ValidatorFilter;
