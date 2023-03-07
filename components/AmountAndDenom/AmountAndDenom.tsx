import utilsStyles from '@styles/utils.module.scss';
import styles from './AmountAndDenom.module.scss';
import Card, { CARD_BG_COLOR, CARD_COLOR, CARD_SIZE } from '@components/Card/Card';
import { formatTokenAmount, getDecimalsFromCurrencyToken, getDisplayDenomFromCurrencyToken } from '@utils/currency';
import { CURRENCY_TOKEN } from 'types/wallet';

type AmountAndDenomProps = {
  amount?: number;
  denom?: string;
  microUnits?: number;
  token?: CURRENCY_TOKEN;
  highlighted?: boolean;
};

const AmountAndDenom = ({ amount, denom, token, microUnits, highlighted = false }: AmountAndDenomProps) => {
  return (
    <div className={utilsStyles.row}>
      <Card
        size={CARD_SIZE.mediumLarge}
        className={styles.amount}
        rounded
        color={highlighted ? CARD_COLOR.lightGrey : CARD_COLOR.text}
        bgColor={highlighted ? CARD_BG_COLOR.primary : CARD_BG_COLOR.lightGrey}
      >
        {formatTokenAmount(amount ?? 0, microUnits ?? getDecimalsFromCurrencyToken(token))}
      </Card>
      <Card
        size={CARD_SIZE.mediumLarge}
        className={styles.denom}
        rounded
        color={highlighted ? CARD_COLOR.lightGrey : CARD_COLOR.text}
        bgColor={highlighted ? CARD_BG_COLOR.primary : CARD_BG_COLOR.lightGrey}
      >
        {denom ?? getDisplayDenomFromCurrencyToken(token)}
      </Card>
    </div>
  );
};

export default AmountAndDenom;
