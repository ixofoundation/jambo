import { HTMLAttributes } from 'react';
import { TailSpin } from 'react-loader-spinner';
import { getCSSVariable } from '@utils/styles';

type LoaderProps = {
	size?: number;
} & HTMLAttributes<HTMLDivElement>;

const Loader = ({ size = 50, className, ...other }: LoaderProps) => {
	const accentColor = getCSSVariable('--accent-color');

	return <TailSpin height={size} width={size} color={accentColor} wrapperClass={className} />;
};

export default Loader;
