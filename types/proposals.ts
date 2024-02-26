import { Proposal, Vote } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';

export type PROPOSAL = Proposal;

export type PROPOSAL_DATA = {
  proposalId: number;
  title: string;
  description: string;
  status: string;
  votingEndTime: number;
  depositEndTime: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  vetoVotes: number;
  totalVotes: number;
  vote?: Vote;
};

export type PROPOSAL_STATE = {
  loading: boolean;
  error?: string;
  data: PROPOSAL_DATA[];
};

export enum VoteOptions {
  VOTE_OPTION_YES = 1,
  VOTE_OPTION_ABSTAIN = 2,
  VOTE_OPTION_NO = 3,
  VOTE_OPTION_NO_WITH_VETO = 4,
}
