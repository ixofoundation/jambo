import React, { createContext, useState, ReactNode, useEffect, useRef } from 'react';
import { cosmos } from '@ixo/impactxclient-sdk';

import { PROPOSAL_DATA, PROPOSAL_STATE } from 'types/proposals';
import useWalletContext from '@hooks/useWalletContext';
import useChainContext from '@hooks/useChainContext';
import { timestampToDate } from '@utils/timestamp';
import { queryProposals, queryVote } from '@utils/query';

type GovContextType = {
  proposals: PROPOSAL_STATE;
  getProposal: (proposalId: number) => PROPOSAL_DATA | undefined;
  fetchProposals: () => Promise<void>;
  fetchProposalVote: (proposalId: number) => Promise<void>;
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
      const proposalsResponse = await queryProposals(
        queryClient,
        cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED,
        '',
        '',
        0,
        50,
      );
      const proposalData = proposalsResponse.map((proposal) => {
        try {
          if (!proposal.content) throw new Error('No content');
          const content = cosmos.gov.v1beta1.TextProposal.decode(proposal.content.value);
          const existingProposal = proposals.data.find((p) => p.proposalId === proposal.proposalId.toNumber());
          return {
            ...(existingProposal ?? {}),
            proposalId: proposal.proposalId.toNumber(),
            title: content.title,
            description: content.description,
            status:
              proposal.status === 1
                ? 'DEPOSIT'
                : proposal.status === 2
                ? 'VOTING'
                : proposal.status === 3
                ? 'PASSED'
                : proposal.status === 4
                ? 'REJECTED'
                : proposal.status === 5
                ? 'FAILED'
                : 'UNKNOWN',
            votingEndTime: timestampToDate(proposal.votingEndTime!)?.getTime() ?? 0,
            depositEndTime: timestampToDate(proposal.depositEndTime!)?.getTime() ?? 0,
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
        .sort((a, b) => ((a?.proposalId ?? 0) > (b?.proposalId ?? 0) ? -1 : 1));
      proposalsLoading.current = false;
      setProposals((prevState) => ({
        ...prevState,
        loading: proposalsLoading.current,
        data: data as PROPOSAL_DATA[],
        error: '',
      }));
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

  const fetchProposalVote = async (proposalId: number) => {
    try {
      if (!queryClient) throw new Error('Query client is not defined');
      const proposalVote = await queryVote(queryClient, wallet.user!?.address ?? '', proposalId);
      if (proposalVote)
        setProposals((prevState) => ({
          ...prevState,
          data: prevState.data.map((proposal) =>
            proposal.proposalId === proposalId ? { ...proposal, vote: proposalVote } : proposal,
          ),
        }));
    } catch (error) {
      console.error('fetchProposalVote::error', error);
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
    fetchProposalVote,
    clearProposals,
  };

  return <GovContext.Provider value={value}>{children}</GovContext.Provider>;
};

export default GovProvider;
