import { ChangeEvent, FC, useState, useEffect } from 'react';

import FormInput from '@components/input/input';
import ColorInput from '@components/color-input';
import styles from './configure-variable.module.scss';
import { getStringColorHex, isColorNotOpacity, isColorValid } from '@utils/colors';
import { getCSSVariable, setCSSVariable } from '@utils/styles';

export enum PropertyInputTypes {
	NUMBER = 'number',
	TEXT = 'text',
	COLOR = 'color',
}

export type ConfigureVariableProps = {
	propertyName: string;
	propertyInputType?: PropertyInputTypes;
};

const ConfigureVariable: FC<ConfigureVariableProps> = ({ propertyName, propertyInputType = PropertyInputTypes.TEXT }) => {
	const [mounted, setMounted] = useState(false);
	const [property, setProperty] = useState<string | number | undefined>(undefined);
	const [color, setColor] = useState<string>('');
	const [colorText, setColorText] = useState<string>('');

	useEffect(() => {
		setMounted(true);
		const originalProperty = getCSSVariable(propertyName) || '';
		if (propertyInputType === PropertyInputTypes.COLOR) {
			setColor(getStringColorHex(originalProperty.trim()));
			setColorText(originalProperty);
		} else {
			if (propertyInputType === PropertyInputTypes.NUMBER) setProperty(Number(originalProperty.replaceAll('px', '').replaceAll('em', '').replaceAll('rem', '')));
			else setProperty(originalProperty);
		}
	}, []);

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		setProperty(e.target.value);
		setCSSVariable(propertyName, e.target.value + 'px');
	};

	const handleColorChangeText = (e: ChangeEvent<HTMLInputElement>) => {
		setColorText(e.target.value);
		if (!isColorValid(e.target.value)) return;
		handleColorChange(getStringColorHex(e.target.value));
	};

	const handleColorChange = (color: string) => {
		if (!isColorNotOpacity(color)) return;
		setColor(color);
		setColorText(color);
		setCSSVariable(propertyName, color);
	};

	return mounted ? (
		propertyInputType === PropertyInputTypes.COLOR ? (
			<div className={styles.configureVariable}>
				<ColorInput label={`${propertyName}: `} color={color} onChange={handleColorChange} className={styles.configureVariableColorInput} />
				<FormInput onChange={handleColorChangeText} label="Hex/Name: " value={colorText} />
			</div>
		) : (
			<FormInput type={propertyInputType.toString()} onChange={handleChange} label={`${propertyName} (px) : `} value={property} />
		)
	) : null;
};

export default ConfigureVariable;
