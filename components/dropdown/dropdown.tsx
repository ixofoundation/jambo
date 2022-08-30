import { FC } from 'react';
import cls from 'classnames';
import Select from 'react-select';

import styles from './dropdown.module.scss';
import { getCSSVariable } from '@utils/styles';

type DropdownProps = React.ComponentProps<typeof Select>;

const Dropdown: FC<DropdownProps> = ({ defaultValue, className, options, onChange, ...other }) => {
	const customStyles = {
		option: (provided: any, state: any) => ({
			...provided,
			backgroundColor: state.isSelected ? getCSSVariable('--accent-color') : null,
		}),
	};

	return <Select defaultValue={defaultValue} onChange={onChange} options={options} className={cls(styles.dropdown, className)} styles={customStyles} {...other} />;
};

export default Dropdown;
