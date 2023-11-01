import { FC } from 'react';

import styles from './VoteButton.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import useModalState from '@hooks/useModalState';
import YesIcon from '@icons/thumbs_up.svg';
import NoIcon from '@icons/thumbs_down.svg';
import AbstainIcon from '@icons/question_mark.svg';
import VetoIcon from '@icons/hand.svg';
import DotsIcon from '@icons/vertical_dots.svg';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { VoteOptions } from 'types/proposals';

type VoteButtonProps = {
  voteOption?: VoteOptions;
  onVoteClick: (voteOption: VoteOptions) => void;
  disabled: boolean;
};

const VoteButton: FC<VoteButtonProps> = ({ voteOption, onVoteClick, disabled }) => {
  const [sheetOpen, openSheet, closeSheet] = useModalState();

  const handleClick = (vote: VoteOptions) => () => {
    onVoteClick(vote);
    closeSheet();
  };

  return (
    <>
      <ButtonRound
        onClick={disabled ? () => undefined : openSheet}
        size={BUTTON_ROUND_SIZE.large}
        color={
          voteOption === VoteOptions.VOTE_OPTION_YES
            ? BUTTON_ROUND_COLOR.primary
            : voteOption === VoteOptions.VOTE_OPTION_NO
            ? BUTTON_ROUND_COLOR.warning
            : voteOption === VoteOptions.VOTE_OPTION_ABSTAIN
            ? BUTTON_ROUND_COLOR.grey
            : voteOption === VoteOptions.VOTE_OPTION_NO_WITH_VETO
            ? BUTTON_ROUND_COLOR.error
            : BUTTON_ROUND_COLOR.lightGrey
        }
      >
        <ColoredIcon
          icon={
            voteOption === VoteOptions.VOTE_OPTION_YES
              ? YesIcon
              : voteOption === VoteOptions.VOTE_OPTION_NO
              ? NoIcon
              : voteOption === VoteOptions.VOTE_OPTION_ABSTAIN
              ? AbstainIcon
              : voteOption === VoteOptions.VOTE_OPTION_NO_WITH_VETO
              ? VetoIcon
              : DotsIcon
          }
          color={voteOption === undefined ? (disabled ? ICON_COLOR.white : ICON_COLOR.primary) : ICON_COLOR.white}
          size={24}
        />
      </ButtonRound>
      {sheetOpen && (
        <BottomSheet dismissable onClose={closeSheet}>
          <Button
            rounded
            label='yes'
            textCentered={false}
            className={styles.button}
            prefixIcon={<ColoredIcon icon={YesIcon} color={ICON_COLOR.white} className={styles.icon} />}
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.primary}
            onClick={handleClick(VoteOptions.VOTE_OPTION_YES)}
          />
          <Button
            rounded
            label='no'
            textCentered={false}
            className={styles.button}
            prefixIcon={<ColoredIcon icon={NoIcon} color={ICON_COLOR.white} className={styles.icon} />}
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.warning}
            onClick={handleClick(VoteOptions.VOTE_OPTION_NO)}
          />
          <Button
            rounded
            label='no with veto'
            textCentered={false}
            className={styles.button}
            prefixIcon={<ColoredIcon icon={VetoIcon} color={ICON_COLOR.white} className={styles.icon} />}
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.error}
            onClick={handleClick(VoteOptions.VOTE_OPTION_NO_WITH_VETO)}
          />
          <Button
            rounded
            label='abstain'
            textCentered={false}
            className={styles.button}
            prefixIcon={<ColoredIcon icon={AbstainIcon} color={ICON_COLOR.white} className={styles.icon} />}
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.grey}
            onClick={handleClick(VoteOptions.VOTE_OPTION_ABSTAIN)}
          />
        </BottomSheet>
      )}
    </>
  );
};

export default VoteButton;
