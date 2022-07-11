import { FC, useState } from 'react';
import { ChromePicker, ChromePickerProps, SketchPicker } from 'react-color';

type ColorInputProps = {
	label: string;
} & ChromePickerProps;

const ColorInput: FC<ColorInputProps> = ({ label, ...other }) => {
	const [show, setShow] = useState(false);

	return (
		<label>
			{label} <span onClick={() => setShow(!show)}>{show ? 'close' : other.color?.toString()}</span>
			{show && <ChromePicker {...other} disableAlpha={true} />}
		</label>
	);
};

export default ColorInput;
