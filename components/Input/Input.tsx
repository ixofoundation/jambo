import { FC, InputHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './Input.module.scss';
import { CURRENCY_TOKEN } from 'types/wallet';
import {
  calculateMaxTokenAmount,
  formattedAmountToNumber,
  getAmountFromCurrencyToken,
  getDecimalsFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';

type InputProps = {
  label?: string;
  align?: 'start' | 'left' | 'center' | 'right' | 'end';
} & InputHTMLAttributes<HTMLInputElement>;

const Input: FC<InputProps> = ({ label, align = 'start', className, ...other }) => {
  return label ? (
    <label className={styles.label}>
      {label}
      <input
        className={cls(
          styles.input,
          align === 'end' || align === 'right'
            ? styles.endAlign
            : align === 'center'
            ? styles.centerAlign
            : styles.startAlign,
          className,
        )}
        {...other}
      />
    </label>
  ) : (
    <input
      className={cls(
        styles.input,
        align === 'end' || align === 'right'
          ? styles.endAlign
          : align === 'center'
          ? styles.centerAlign
          : styles.startAlign,
        className,
      )}
      {...other}
    />
  );
};

export default Input;

type InputWithMaxProps = {
  maxAmount?: number;
  maxToken?: CURRENCY_TOKEN;
  onMaxClick: (amount: number) => void;
} & InputProps;

export const InputWithMax = ({ maxAmount, maxToken, onMaxClick, ...other }: InputWithMaxProps) => {
  const amount = calculateMaxTokenAmount(
    maxAmount ?? getAmountFromCurrencyToken(maxToken),
    getDecimalsFromCurrencyToken(maxToken),
    true,
  );
  const denom = getDisplayDenomFromCurrencyToken(maxToken);

  const handleMaxClick = () => onMaxClick(formattedAmountToNumber(amount));

  return (
    <>
      <p className={cls(styles.max, styles.endAlign)} onClick={handleMaxClick}>
        {amount} {denom} MAX
      </p>
      <Input {...other} />
    </>
  );
};
