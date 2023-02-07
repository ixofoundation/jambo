import styles from './Switch.module.scss';

type Option = {
	label: string;
	value: string;
};

type SwitchProps = {
	option1: Option;
	option2: Option;
	selectedOption: string;
	onOptionSelect: (value: string) => void;
};

const Switch = ({ option1, option2, selectedOption, onOptionSelect }: SwitchProps) => {
	const handleOptionSelect = (value: string) => () => onOptionSelect(value);
	return (
		<div className={styles.switchWrapper}>
			<div
				className={`${styles.option} ${option1.value === selectedOption && styles.selectedOption}`}
				onClick={option1.value !== selectedOption ? handleOptionSelect(option1.value) : () => {}}
			>
				{option1.label}
			</div>
			<div
				className={`${styles.option} ${option2.value === selectedOption && styles.selectedOption}`}
				onClick={option2.value !== selectedOption ? handleOptionSelect(option2.value) : () => {}}
			>
				{option2.label}
			</div>
		</div>
	);
};

export default Switch;
