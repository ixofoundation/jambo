import { ChangeEvent, FC, useState, useEffect } from 'react';

import FormInput from '@components/input/input';
import ColorInput from '@components/color-input';
import styles from './configure-variable.module.scss';
import { getStringColorHex, isColorNotOpacity, isColorValid } from '@utils/colors';

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
		const originalProperty = getProperty();
		if (propertyInputType === PropertyInputTypes.COLOR) {
			console.log(getStringColorHex((originalProperty as string).trim()));
			setColor(getStringColorHex((originalProperty as string).trim()));
			setColorText(originalProperty as string);
		} else setProperty(originalProperty);
	}, []);

	const getProperty = () => {
		if (typeof window !== 'undefined') {
			let value = getComputedStyle(document.documentElement).getPropertyValue(propertyName);
			return propertyInputType === PropertyInputTypes.NUMBER ? Number(value.replaceAll('px', '').replaceAll('em', '').replaceAll('rem', '')) : value;
		} else return '';
	};

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		setProperty(e.target.value);
		document.documentElement.style.setProperty(propertyName, e.target.value + 'px');
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
		document.documentElement.style.setProperty(propertyName, color);
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
