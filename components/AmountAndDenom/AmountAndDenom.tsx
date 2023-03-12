import utilsStyles from '@styles/utils.module.scss';
import styles from './AmountAndDenom.module.scss';
import Card, { CARD_BG_COLOR, CARD_COLOR, CARD_SIZE } from '@components/Card/Card';
import {
  formatTokenAmount,
  getAmountFromCurrencyToken,
  getDecimalsFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';
import { CURRENCY_TOKEN } from 'types/wallet';

type AmountAndDenomProps = {
  amount?: number;
  denom?: string;
  microUnits?: number;
  token?: CURRENCY_TOKEN;
  color?: CARD_COLOR;
  bgColor?: CARD_BG_COLOR;
};

const AmountAndDenom = ({
  amount,
  denom,
  token,
  microUnits,
  color = CARD_COLOR.text,
  bgColor = CARD_BG_COLOR.lightGrey,
}: AmountAndDenomProps) => {
  return (
    <div className={utilsStyles.row}>
      <Card size={CARD_SIZE.mediumLarge} className={styles.amount} rounded color={color} bgColor={bgColor}>
        {formatTokenAmount(
          amount ?? getAmountFromCurrencyToken(token),
          microUnits ?? getDecimalsFromCurrencyToken(token),
        )}
      </Card>
      <Card size={CARD_SIZE.mediumLarge} className={styles.denom} rounded color={color} bgColor={bgColor}>
        {denom ?? getDisplayDenomFromCurrencyToken(token)}
      </Card>
    </div>
  );
};

export default AmountAndDenom;
