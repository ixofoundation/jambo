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
import Card, { CARD_BG_COLOR, CARD_SIZE } from '@components/Card/Card';

type TextAreaProps = {
  label?: string;
  align?: 'start' | 'left' | 'center' | 'right' | 'end';
  bgColor?: CARD_BG_COLOR;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextArea: FC<TextAreaProps> = ({
  label,
  align = 'start',
  bgColor = CARD_BG_COLOR.lightGrey,
  className,
  ...other
}) => {
  return label ? (
    <label className={styles.label}>
      {label}
      <Card className={styles.inputContainer} bgColor={bgColor} size={CARD_SIZE.xxsmall}>
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
      </Card>
    </label>
  ) : (
    <Card className={styles.inputContainer} bgColor={bgColor} size={CARD_SIZE.xxsmall}>
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
    </Card>
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
