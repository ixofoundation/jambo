import { HTMLAttributes } from 'react';
import styles from './MultiSendCard.module.scss';
import { CURRENCY } from '../../types/wallet';
import Card, { CARD_BG_COLOR, CARD_COLOR, CARD_SIZE } from '@components/Card/Card';
import AmountAndDenom from '@components/AmountAndDenom/AmountAndDenom';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Cross from '@icons/cross.svg';
import Edit from '@icons/edit.svg';
import { getDisplayDenomFromCurrencyToken } from '@utils/currency';
import cls from 'classnames';

export type MultiSendProps = {
  address?: string | string[];
  token?: CURRENCY | undefined;
  amount?: number | undefined;
  onDeleteClick: () => void;
  onEditClick: () => void;
} & HTMLAttributes<HTMLDivElement>;

const MultiSendCard = ({ address, token, amount, onDeleteClick, onEditClick }: MultiSendProps) => {
  const handleDeleteClick = (e: Event | any) => {
    e.preventDefault();
    onDeleteClick();
  };

  const handleEditClick = (e: Event | any) => {
    e.preventDefault();
    onEditClick();
  };

  return (
    <Card className={cls(styles.wrapper)}>
      <div className={styles.cardContent}>
        <div className={styles.contentWrapper}>
          <AmountAndDenom
            amount={amount}
            denom={getDisplayDenomFromCurrencyToken(token)}
            color={CARD_COLOR.text}
            bgColor={CARD_BG_COLOR.white}
          />
          <div className={styles.multiMsgAddresses}>
            <p>to:</p>
            <Card bgColor={CARD_BG_COLOR.white} rounded className={styles.addressCard} size={CARD_SIZE.mediumLarge}>
              {address}
            </Card>
          </div>
        </div>
        <div className={styles.btnLayout}>
          <ButtonRound
            className={styles.cancelBtn}
            size={BUTTON_ROUND_SIZE.mediumLarge}
            color={BUTTON_ROUND_COLOR.white}
            onClick={handleDeleteClick}
          >
            <ColoredIcon icon={Cross} size={23} color={ICON_COLOR.primary} />
          </ButtonRound>
          <ButtonRound
            className={styles.editBtn}
            size={BUTTON_ROUND_SIZE.mediumLarge}
            color={BUTTON_ROUND_COLOR.white}
            onClick={handleEditClick}
          >
            <ColoredIcon icon={Edit} size={23} color={ICON_COLOR.primary} />
          </ButtonRound>
        </div>
      </div>
    </Card>
  );
};

export default MultiSendCard;
