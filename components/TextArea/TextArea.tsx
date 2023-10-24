import { FC, TextareaHTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './TextArea.module.scss';
import { CURRENCY_TOKEN } from 'types/wallet';
import {
  calculateMaxTokenAmount,
  formattedAmountToNumber,
  getAmountFromCurrencyToken,
  getDecimalsFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';

type TextAreaProps = {
  label?: string;
  align?: 'start' | 'left' | 'center' | 'right' | 'end';
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextArea: FC<TextAreaProps> = ({ label, align = 'start', className, ...other }) => {
  return label ? (
    <label className={styles.label}>
      {label}
      <textarea
        className={cls(
          styles.textarea,
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
    <textarea
      className={cls(
        styles.textarea,
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

export default TextArea;

type TextAreaWithMaxProps = {
  maxAmount?: number;
  maxToken?: CURRENCY_TOKEN;
  onMaxClick: (amount: number) => void;
} & TextAreaProps;

export const TextAreaWithMax = ({ maxAmount, maxToken, onMaxClick, ...other }: TextAreaWithMaxProps) => {
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
      <TextArea {...other} />
    </>
  );
};
