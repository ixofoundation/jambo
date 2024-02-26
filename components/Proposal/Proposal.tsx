import cls from 'classnames';

import styles from './Proposal.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import HourglassIcon from '@icons/hourglass.svg';
import ThumbsUpIcon from '@icons/thumbs_up.svg';
import ThumbsDownIcon from '@icons/thumbs_down.svg';
import HandIcon from '@icons/hand.svg';
import QuestionMarkIcon from '@icons/question_mark.svg';
import CountdownTimer from '@components/CountdownTimer/CountdownTimer';
import { getCSSVariable } from '@utils/styles';
import { useEffect, useRef } from 'react';
import useIsInViewport from '@hooks/useIsInViewport';
import { Vote } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import useGovContext from '@hooks/useGovContext';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';

type ProposalProps = {
  proposer?: string;
  proposalId: number;
  status: string;
  votingEndTime: Date | number | string;
  depositEndTime: Date | number | string;
  title: string;
  description: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  vetoVotes: number;
  totalVotes: number;
  minify?: boolean;
  vote?: Vote;
  onClick?: () => void;
};

const Proposal = ({
  proposalId,
  status,
  votingEndTime,
  depositEndTime,
  title,
  description,
  minify = false,
  yesVotes = 0,
  noVotes = 0,
  abstainVotes = 0,
  vetoVotes = 0,
  totalVotes = 0,
  vote,
  onClick,
}: ProposalProps) => {
  const ref = useRef(null);
  const { fetchProposalVote } = useGovContext();

  const isInViewport = useIsInViewport(ref);

  useEffect(() => {
    if (isInViewport && status === 'VOTING') fetchProposalVote(proposalId);
  }, [isInViewport]);

  return (
    <div
      ref={ref}
      onClick={onClick ?? (() => undefined)}
      className={cls([
        styles.proposal,
        minify ? styles.minifiedProposal : styles.fullProposal,
        vote?.options?.[0]?.option === 1
          ? styles.votedYes
          : vote?.options?.[0]?.option === 2
          ? styles.votedAbstain
          : vote?.options?.[0]?.option === 3
          ? styles.votedNo
          : vote?.options?.[0]?.option === 4
          ? styles.votedVeto
          : styles.votedUnknown,
      ])}
    >
      <div className={utilsStyles.rowJustifySpaceBetween}>
        <div className={utilsStyles.rowAlignCenter}>
          <h4 className={styles.id}>#{proposalId}</h4>
          <div
            className={cls(
              styles.badge,
              status === 'DEPOSIT'
                ? styles.warning
                : status === 'VOTING'
                ? styles.primary
                : status === 'PASSED'
                ? styles.success
                : status === 'FAILED' || status === 'REJECTED'
                ? styles.error
                : styles.grey,
            )}
          >
            {status}
          </div>
        </div>
        <div className={utilsStyles.rowAlignCenter}>
          <HourglassIcon width={20} height={20} color={getCSSVariable('--lighter-font-color')} />
          <CountdownTimer targetDate={status === 'DEPOSIT' ? depositEndTime : votingEndTime} className={styles.timer} />
        </div>
      </div>
      <div className={utilsStyles.spacer1} />
      <div className={cls(utilsStyles.row, styles.votesBar)}>
        <div style={{ width: `${(yesVotes / totalVotes) * 100}%` }} className={cls(styles.voteBar, styles.yesBar)} />
        <div style={{ width: `${(noVotes / totalVotes) * 100}%` }} className={cls(styles.voteBar, styles.noBar)} />
        <div style={{ width: `${(vetoVotes / totalVotes) * 100}%` }} className={cls(styles.voteBar, styles.vetoBar)} />
        <div
          style={{ width: `${(abstainVotes / totalVotes) * 100}%` }}
          className={cls(styles.voteBar, styles.abstainBar)}
        />
      </div>
      <div className={utilsStyles.spacer1} />
      <h3 className={styles.title}>{title}</h3>
      <div className={utilsStyles.spacer1} />
      <div>
        <p className={styles.description}>{description}</p>
      </div>

      {vote?.options?.[0]?.option === 1 ? (
        <ButtonRound className={styles.vote} color={BUTTON_ROUND_COLOR.primary} size={BUTTON_ROUND_SIZE.medium}>
          <ColoredIcon icon={ThumbsUpIcon} color={ICON_COLOR.white} />
        </ButtonRound>
      ) : vote?.options?.[0]?.option === 2 ? (
        <ButtonRound className={styles.vote} color={BUTTON_ROUND_COLOR.grey} size={BUTTON_ROUND_SIZE.medium}>
          <ColoredIcon icon={QuestionMarkIcon} color={ICON_COLOR.white} />
        </ButtonRound>
      ) : vote?.options?.[0]?.option === 3 ? (
        <ButtonRound className={styles.vote} color={BUTTON_ROUND_COLOR.warning} size={BUTTON_ROUND_SIZE.medium}>
          <ColoredIcon icon={ThumbsDownIcon} color={ICON_COLOR.white} />
        </ButtonRound>
      ) : vote?.options?.[0]?.option === 4 ? (
        <ButtonRound className={styles.vote} color={BUTTON_ROUND_COLOR.error} size={BUTTON_ROUND_SIZE.medium}>
          <ColoredIcon icon={HandIcon} color={ICON_COLOR.white} />
        </ButtonRound>
      ) : null}
    </div>
  );
};

export default Proposal;
