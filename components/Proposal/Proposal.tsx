import cls from 'classnames';

import styles from './Proposal.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import UserIcon from '@icons/user.svg';
import HourglassIcon from '@icons/hourglass.svg';
import CountdownTimer from '@components/CountdownTimer/CountdownTimer';
import { getCSSVariable } from '@utils/styles';

type ProposalProps = {
  proposer?: string;
  votingEndTime: Date | number | string;
  title: string;
  description: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  vetoVotes: number;
  totalVotes: number;
  minify?: boolean;
  onClick?: () => void;
};

const Proposal = ({
  proposer,
  votingEndTime,
  title,
  description,
  minify = false,
  yesVotes = 0,
  noVotes = 0,
  abstainVotes = 0,
  vetoVotes = 0,
  totalVotes = 0,
  onClick,
}: ProposalProps) => {
  return (
    <div
      onClick={onClick ?? (() => undefined)}
      className={cls([styles.proposal, minify ? styles.minifiedProposal : styles.fullProposal])}
    >
      <div className={utilsStyles.rowJustifySpaceBetween}>
        <div className={utilsStyles.rowAlignCenter}>
          {!!proposer ?? (
            <>
              <UserIcon width={20} height={20} color={getCSSVariable('--lighter-font-color')} />
              <h4 className={styles.proposer}>{proposer}</h4>
            </>
          )}
        </div>
        <div className={utilsStyles.rowAlignCenter}>
          <HourglassIcon width={20} height={20} color={getCSSVariable('--lighter-font-color')} />
          <CountdownTimer targetDate={votingEndTime} className={styles.timer} />
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
    </div>
  );
};

export default Proposal;
