import { ChangeEvent, FC, InputHTMLAttributes, useState } from 'react';

import cls from 'classnames';

import {
  calculateMaxTokenAmount,
  formattedAmountToNumber,
  getAmountFromCurrencyToken,
  getDecimalsFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';
import { CURRENCY_TOKEN } from 'types/wallet';

import styles from './Input.module.scss';

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
  decimalAmount?: boolean;
  onMaxClick: (amount: number) => void;
} & InputProps;

export const InputWithMax = ({
  maxAmount,
  maxToken,
  onMaxClick,
  decimalAmount = true,
  className,
  onChange,
  ...other
}: InputWithMaxProps) => {
  const [isMaxExceeded, setIsMaxExceeded] = useState(false);
  const amount = calculateMaxTokenAmount(
    maxAmount ?? getAmountFromCurrencyToken(maxToken),
    getDecimalsFromCurrencyToken(maxToken),
    true,
    decimalAmount,
  );
  const denom = getDisplayDenomFromCurrencyToken(maxToken);

  const handleMaxClick = () => onMaxClick(formattedAmountToNumber(amount));
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (maxToken) {
      setIsMaxExceeded(formattedAmountToNumber(event.target.value.toString()) > formattedAmountToNumber(amount));
    }

    onChange && onChange(event);
  };

  return (
    <>
      <p className={cls(styles.max, styles.endAlign)} onClick={handleMaxClick}>
        {amount} {denom} MAX
      </p>
      <Input
        className={cls(className, isMaxExceeded ? styles.exceededMax : undefined)}
        onChange={handleInputChange}
        {...other}
      />
    </>
  );
};
