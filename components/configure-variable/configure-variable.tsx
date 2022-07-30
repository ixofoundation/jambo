import { ChangeEvent, FC, useState, useEffect } from 'react';
import { ColorChangeHandler, Color } from 'react-color';

import FormInput from '@components/form-input/form-input';
import ColorInput from '@components/color-input';

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
	const [color, setColor] = useState<Color | undefined>(undefined);

	useEffect(() => {
		setMounted(true);
		propertyInputType === PropertyInputTypes.COLOR ? setColor(getProperty() as Color) : setProperty(getProperty());
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

	const handleColorChange: ColorChangeHandler = color => {
		setColor(color.hex);
		document.documentElement.style.setProperty(propertyName, color.hex);
	};

	return mounted ? (
		propertyInputType === PropertyInputTypes.COLOR ? (
			<ColorInput label={`${propertyName}: `} color={color} onChangeComplete={handleColorChange} />
		) : (
			<FormInput type={propertyInputType.toString()} onChange={handleChange} label={`${propertyName} (px) : `} value={property} />
		)
	) : null;
};

export default ConfigureVariable;
