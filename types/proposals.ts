import { Proposal } from "@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1/gov";
import { Deposit } from "@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1/gov";
import { WeightedVoteOption } from "@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1/gov";
import { TallyResult } from "@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1/gov";
import { Vote } from "@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1/gov";

export type PROPOSAL = Proposal

export type PROPOSAL_DATA = {
    id: string;
    title: string;
    description: string;
    proposer: string;
    status: 'pending' | 'active' | 'passed' | 'failed' | 'cancelled';
    submitTime: Date;
    votingStartTime?: Date;
    votingEndTime?: Date;
    yesVotes: number;
    noVotes: number;
    abstainVotes: number;
    totalVotes: number;
    deposits: Deposit[];
    weightedVoteOptions: WeightedVoteOption[];
    tallyResult: TallyResult;
    votes: Vote[];
} & PROPOSAL
