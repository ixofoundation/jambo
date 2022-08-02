import { FC, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { ColorPickerBaseProps } from 'react-colorful/dist/types';

type ColorInputProps = {
	label: string;
} & Partial<ColorPickerBaseProps<string>>;

const ColorInput: FC<ColorInputProps> = ({ label, ...other }) => {
	const [show, setShow] = useState(true);

	return (
		// <label>
		// 	{label} <span onClick={() => setShow(!show)}>{show ? 'close' : other.color?.toString()}</span>
		<HexColorPicker {...other} />
		// </label>
	);
};

export default ColorInput;
