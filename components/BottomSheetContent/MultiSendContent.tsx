import { HTMLAttributes } from 'react';
import styling from './MultiSendContent.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import Correct from '@icons/correct.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';

export type MultiSendContentProps = {
  onDeleteMsgClicked: () => void;
  onCloseBottomSheet: () => void;
} & HTMLAttributes<HTMLDivElement>;

const MultiSendContent = ({ onDeleteMsgClicked, onCloseBottomSheet }: MultiSendContentProps) => {
  const handleDeleteMsg = (e: Event | any) => {
    e.preventDefault();
    onDeleteMsgClicked();
  };

  const handleCloseMultiSheet = (e: Event | any) => {
    e.preventDefault();
    onCloseBottomSheet();
  };
  return (
    <div className={styling.bottomSheetContent}>
      <div className={styling.bottomSheetText}>
        <span className={styling.spaceBetweenText}>Are you sure you wish to remove</span> <br />{' '}
        <span>this send action ?</span>
      </div>
      <div className={styling.btnSpacing}>
        <ButtonRound
          className={styling.cancelBottomSheetBtn}
          size={BUTTON_ROUND_SIZE.large}
          color={BUTTON_ROUND_COLOR.white}
          onClick={handleCloseMultiSheet}
        >
          <ColoredIcon icon={ArrowLeft} size={25} color={ICON_COLOR.primary} />
        </ButtonRound>

        <ButtonRound size={BUTTON_ROUND_SIZE.large} onClick={handleDeleteMsg}>
          <Correct className={styling.plusIcon} />
        </ButtonRound>
      </div>
    </div>
  );
};

export default MultiSendContent;
