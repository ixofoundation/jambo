import { FC, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import Proposal from '@components/Proposal/Proposal';
import useGovContext from '@hooks/useGovContext';
import useChainContext from '@hooks/useChainContext';
import { STEPS, StepConfigType, StepDataType } from 'types/steps';
import IconText from '@components/IconText/IconText';
import SadFace from '@icons/sad_face.svg';

type SelectGovProposalProps = {
  onSuccess: (data: StepDataType<STEPS.select_proposal>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.select_proposal>;
  config?: StepConfigType<STEPS.select_proposal>;
  header?: string;
};

const SelectGovProposal: FC<SelectGovProposalProps> = ({ onSuccess, onBack, header }) => {
  const { proposals, fetchProposals } = useGovContext();
  const { queryClient } = useChainContext();

  useEffect(() => {
    fetchProposals();
  }, [queryClient]);

  const handleClick = (proposalId: number) => () => {
    if (proposalId === undefined) return;
    onSuccess({ proposalId });
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {proposals.data?.length ? (
          <div>
            {(proposals?.data ?? []).map((proposal) => (
              <Proposal
                minify
                key={proposal.proposalId}
                onClick={handleClick(proposal.proposalId)}
                proposalId={proposal.proposalId}
                status={proposal.status}
                votingEndTime={proposal.votingEndTime}
                depositEndTime={proposal.depositEndTime}
                title={proposal.title}
                description={proposal.description}
                yesVotes={proposal.yesVotes}
                noVotes={proposal.noVotes}
                abstainVotes={proposal.abstainVotes}
                vetoVotes={proposal.vetoVotes}
                totalVotes={proposal.totalVotes}
                vote={proposal.vote}
              />
            ))}
          </div>
        ) : proposals.loading ? (
          <Loader />
        ) : (
          <IconText title='No proposals found' Img={SadFace} imgSize={50} />
        )}
      </main>

      <Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} />
    </>
  );
};

export default SelectGovProposal;
