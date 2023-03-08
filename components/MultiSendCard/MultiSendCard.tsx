import { HTMLAttributes, useState } from 'react';
import styling from './MultiSend.module.scss';
import { CURRENCY } from '../../types/wallet';
import Card from '@components/Card/Card';
import Input from '@components/Input/Input';
import AmountAndDenom from '@components/AmountAndDenom/AmountAndDenom';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Cross from '@icons/cross.svg';
import { getDisplayDenomFromCurrencyToken } from '@utils/currency';

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
    <>
      <Card className={styling.spaceBetweenCards}>
        <div className={styling.cardContent}>
          <div className={styling.contentWrapper}>
            <AmountAndDenom amount={amount} denom={getDisplayDenomFromCurrencyToken(token)} />
            <div className={styling.multiMsgAddresses}>
              <p className={styling.addressLabel}>to:</p>
              <Input
                name='address'
                required
                value={address}
                className={styling.multiMsgAddressesInput}
                align='center'
                disabled
              />
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
    </>
  );
};

export default MultiSendCard;
