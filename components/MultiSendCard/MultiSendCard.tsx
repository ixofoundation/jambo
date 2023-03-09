import { HTMLAttributes } from 'react';
import styling from './MultiSendCard.module.scss';
import { CURRENCY } from '../../types/wallet';
import Card, { CARD_BG_COLOR, CARD_COLOR, CARD_SIZE } from '@components/Card/Card';
import Input from '@components/Input/Input';
import AmountAndDenom from '@components/AmountAndDenom/AmountAndDenom';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Cross from '@icons/cross.svg';
import { getDisplayDenomFromCurrencyToken } from '@utils/currency';
import cls from 'classnames';

export type MultiSendProps = {
  address?: string | string[];
  token?: CURRENCY | undefined;
  amount?: number | undefined;
  onDeleteClick: () => void;
} & HTMLAttributes<HTMLDivElement>;

const MultiSendCard = ({ address, token, amount, onDeleteClick }: MultiSendProps) => {
  const handleDeleteClick = (e: Event | any) => {
    e.preventDefault();
    onDeleteClick();
  };

  return (
    <Card className={cls(styling.wrapper)}>
      <div className={styling.cardContent}>
        <div className={styling.contentWrapper}>
          <AmountAndDenom
            amount={amount}
            denom={getDisplayDenomFromCurrencyToken(token)}
            color={CARD_COLOR.text}
            bgColor={CARD_BG_COLOR.white}
          />
          <div className={styling.multiMsgAddresses}>
            <p>to:</p>
            <Card bgColor={CARD_BG_COLOR.white} rounded className={styling.addressCard} size={CARD_SIZE.mediumLarge}>
              {address}
            </Card>
          </div>
        </div>
        <ButtonRound
          className={styling.cancelBtn}
          size={BUTTON_ROUND_SIZE.mediumLarge}
          color={BUTTON_ROUND_COLOR.white}
          onClick={handleDeleteClick}
        >
          <ColoredIcon icon={Cross} size={23} color={ICON_COLOR.primary} />
        </ButtonRound>
      </div>
    </Card>
  );
};

export default MultiSendCard;
