import utilsStyles from '@styles/utils.module.scss';
import styles from './AmountAndDenom.module.scss';
import Card, { CARD_BG_COLOR, CARD_COLOR, CARD_SIZE } from '@components/Card/Card';
import { formatTokenAmount } from '@utils/currency';

type AmountAndDenomProps = {
  amount?: number;
  denom?: string;
  microUnits?: number;
  highlighted?: boolean;
};

// TODO: use full token instead of just denom

const AmountAndDenom = ({ amount, denom, microUnits = 0, highlighted = false }: AmountAndDenomProps) => {
  return (
    <div className={utilsStyles.row}>
      <Card
        size={CARD_SIZE.mediumLarge}
        className={styles.amount}
        rounded
        color={highlighted ? CARD_COLOR.lightGrey : CARD_COLOR.text}
        bgColor={highlighted ? CARD_BG_COLOR.primary : CARD_BG_COLOR.lightGrey}
      >
        {formatTokenAmount(amount ?? 0, microUnits)}
      </Card>
      <Card
        size={CARD_SIZE.mediumLarge}
        className={styles.denom}
        rounded
        color={highlighted ? CARD_COLOR.lightGrey : CARD_COLOR.text}
        bgColor={highlighted ? CARD_BG_COLOR.primary : CARD_BG_COLOR.lightGrey}
      >
        {denom ?? '-'}
      </Card>
    </div>
  );
};

export default AmountAndDenom;
