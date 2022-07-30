import { FC, InputHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './search-input.module.scss';
import Search from '@icons/search.svg';

type SearchInputProps = {
	label?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const SearchInput: FC<SearchInputProps> = ({ label, className, ...other }) => {
	return (
		<div className={styles.searchInputContainer}>
			<Search />
			<input className={cls(styles.searchInput, className)} {...other} />
		</div>
	);
};

export default SearchInput;
