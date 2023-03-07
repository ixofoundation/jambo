import { HTMLAttributes } from 'react';
import { TailSpin } from 'react-loader-spinner';
import { getCSSVariable } from '@utils/styles';

type LoaderProps = {
  size?: number;
} & HTMLAttributes<HTMLDivElement>;

const Loader = ({ size = 50, className, ...other }: LoaderProps) => {
  const primaryColor = getCSSVariable('--primary-color');

  return <TailSpin height={size} width={size} color={primaryColor ?? '#000'} wrapperClass={className} />;
};

export default Loader;
