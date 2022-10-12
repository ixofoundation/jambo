import { FC } from 'react';
import cls from 'classnames';
import Select, { components } from 'react-select';

import styles from './dropdown.module.scss';
import { getCSSVariable } from '@utils/styles';
import ImageWithFallback from '@components/image-fallback/image-fallback';

type DropdownProps = {
	withChainLogos?: boolean;
} & React.ComponentProps<typeof Select>;

const Dropdown: FC<DropdownProps> = ({ defaultValue, className, options, onChange, withChainLogos = false, ...other }) => {
	const customStyles = {
		option: (provided: any, state: any) => ({
			...provided,
			backgroundColor: state.isSelected ? getCSSVariable('--accent-color') : null,
		}),
	};

	return (
		<Select
			defaultValue={defaultValue}
			onChange={onChange}
			options={options}
			className={cls(styles.dropdown, className)}
			styles={customStyles}
			components={withChainLogos ? { Option: IconOption, SingleValue: CustomSelectValue } : undefined}
			{...other}
		/>
	);
};

export default Dropdown;

const { Option } = components;
const IconOption = (props: any) => {
	return (
		<Option {...props}>
			<div className={styles.imageOption}>
				<ImageWithFallback src={'/images/chain-logos/' + props.data.value + '.png'} fallbackSrc={'/images/chain-logos/fallback.png'} width={20} height={20} alt={props.data.label} />
				<p>{props.data.label}</p>
			</div>
		</Option>
	);
};

const { SingleValue } = components;
const CustomSelectValue = (props: any) => {
	return (
		<SingleValue {...props}>
			<div className={styles.imageOption}>
				<ImageWithFallback src={'/images/chain-logos/' + props.data.value + '.png'} fallbackSrc={'/images/chain-logos/fallback.png'} width={20} height={20} alt={props.data.label} />
				<p>{props.data.label}</p>
			</div>
		</SingleValue>
	);
};
