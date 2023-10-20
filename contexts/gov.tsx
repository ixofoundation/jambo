import React, { createContext, useState, ReactNode, useEffect, useRef } from 'react';
import { cosmos } from '@ixo/impactxclient-sdk';

import { PROPOSAL_DATA, PROPOSAL_STATE } from 'types/proposals';
import useWalletContext from '@hooks/useWalletContext';
import useChainContext from '@hooks/useChainContext';
import { timestampToDate } from '@utils/timestamp';
import { queryVote } from '@utils/query';

type GovContextType = {
  proposals: PROPOSAL_STATE;
  getProposal: (proposalId: number) => PROPOSAL_DATA | undefined;
  fetchProposals: () => Promise<void>;
  clearProposals: () => void;
};

export const GovContext = createContext<GovContextType | undefined>(undefined);

type GovProviderProps = {
  children: ReactNode;
};

const INITIAL_STATE = {
  loading: false,
  error: undefined,
  data: [],
};

const GovProvider = ({ children }: GovProviderProps) => {
  const [proposals, setProposals] = useState<PROPOSAL_STATE>(INITIAL_STATE);
  const proposalsLoading = useRef<boolean>(false);

  const { queryClient } = useChainContext();
  const { wallet } = useWalletContext();

  const getProposal = (proposalId: number) =>
    (proposals?.data ?? []).find((proposal) => proposal.proposalId === proposalId);

  const fetchProposals = async () => {
    try {
      if (proposalsLoading.current) return;
      proposalsLoading.current = true;
      setProposals((prevState) => ({ ...prevState, loading: proposalsLoading.current }));
      if (!queryClient) throw new Error('QueryClient is not defined');
      const proposalsResponse = await queryClient.cosmos.gov.v1beta1.proposals({
        proposalStatus: cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED,
        voter: '',
        depositor: '',
      });
      const proposalData = (proposalsResponse?.proposals ?? []).map((proposal) => {
        try {
          if (!proposal.content) throw new Error('No content');
          const content = cosmos.gov.v1beta1.TextProposal.decode(proposal.content.value);
          return {
            proposalId: proposal.proposalId.toNumber(),
            title: content.title,
            description: content.description,
            status: proposal.status,
            votingEndTime: timestampToDate(proposal.votingEndTime!)?.getTime() ?? 0,
            yesVotes: Number(proposal.finalTallyResult?.yes ?? 0),
            noVotes: Number(proposal.finalTallyResult?.no ?? 0),
            abstainVotes: Number(proposal.finalTallyResult?.abstain ?? 0),
            vetoVotes: Number(proposal.finalTallyResult?.noWithVeto ?? 0),
            totalVotes:
              Number(proposal.finalTallyResult?.yes ?? 0) +
              Number(proposal.finalTallyResult?.no ?? 0) +
              Number(proposal.finalTallyResult?.abstain ?? 0) +
              Number(proposal.finalTallyResult?.noWithVeto ?? 0),
          } as PROPOSAL_DATA;
        } catch (error) {
          console.error('fetchProposals::proposal::error', error);
          return null;
        }
      });
      const data = proposalData
        .filter((proposal) => !!proposal)
        .sort((a, b) => ((a?.votingEndTime ?? 0) > (b?.votingEndTime ?? 0) ? -1 : 1));
      proposalsLoading.current = false;
      setProposals((prevState) => ({
        ...prevState,
        loading: proposalsLoading.current,
        data: data as PROPOSAL_DATA[],
        error: '',
      }));
      // const proposalVotes = await Promise.all(
      //   (data ?? []).map((proposal) => queryVote(queryClient, wallet.user!?.address ?? '', proposal?.proposalId ?? -1)),
      // );
      // const proposalsWithVotes = proposalVotes.map((vote, index) => {
      //   const proposal = data[index];
      //   return {
      //     ...proposal,
      //     vote: vote?.options ?? 0,
      //   };
      // });
      // TODO: add voted vote to proposal
    } catch (error) {
      console.error('fetchProposals::error', error);
      proposalsLoading.current = false;
      setProposals((prevState) => ({
        ...prevState,
        loading: proposalsLoading.current,
        error: (error as { message: string }).message,
      }));
    }
  };

  const clearProposals = () => {
    proposalsLoading.current = false;
    setProposals(INITIAL_STATE);
  };

  useEffect(() => {
    clearProposals();
  }, [queryClient]);

  const value = {
    proposals,
    getProposal,
    fetchProposals,
    clearProposals,
  };

  return <GovContext.Provider value={value}>{children}</GovContext.Provider>;
};

export default GovProvider;
