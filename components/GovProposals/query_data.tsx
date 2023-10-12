<<<<<<< HEAD
import React, { useEffect, useState } from 'react'
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { cosmos } from '@ixo/impactxclient-sdk';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';

export const queryProposals = () => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const { queryClient } = useQueryClient();
    const proposalStatus = cosmos.gov.v1beta1.ProposalStatus.UNRECOGNIZED
=======
import React, { useContext, useEffect, useState } from 'react'
import { cosmos } from '@ixo/impactxclient-sdk';
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import useQueryClient from '@hooks/useQueryClient';
import { generateVoteTrx } from '@utils/transactions';
import { WalletContext } from '@contexts/wallet';

export const queryProposals = () => {
    const [proposals, renderProposals] = useState<Proposal[]>([]);
    const { queryClient } = useQueryClient();
    const proposalStatus = cosmos.gov.v1beta1.ProposalStatus.UNRECOGNIZED;
>>>>>>> main
    useEffect(() => {
        const fetchProposals = async () => {
            const proposalsRequest: QueryProposalsRequest = {
                proposalStatus: proposalStatus,
                voter: "",
                depositor: "",
            }
            const response = await queryClient?.cosmos.gov.v1beta1.proposals(proposalsRequest);
            if (response?.proposals) {
<<<<<<< HEAD
                setProposals(response.proposals);
            }
            console.log(response?.proposals);
        }
        fetchProposals();
    }, []);
    return proposals;
=======
                renderProposals(response.proposals);
            }
            console.log(response?.proposals);
        }
        fetchProposals()
    }, [])
    return proposals;
}

export const handleSelect = (proposalId: number) => {
    const [toggleVoteActions, setToggleVoteActions] = useState(false);
    const [selected, setSelected] = useState<{ proposalId: number } | null>(null);
    const [selectedOption, setSelectedOption] = useState<'1' | '2' | '3' | '4'>();
    const proposals = queryProposals();
    const { wallet } = useContext(WalletContext);
    if (!toggleVoteActions) {
        const selectedProposal = proposals.find((proposal) => proposal.proposalId === proposalId);
        if (selectedProposal) {
            if (selected && selected.proposalId === proposalId) {
                setSelected(null);
            } else {
                setSelected(selectedProposal);
                const voteTrx = generateVoteTrx({
                    proposalId: selectedProposal.proposalId,
                    voterAddress: wallet.user!.address,
                    option: selectedOption,
                });
                console.log(voteTrx);
            }
        }
        console.log(proposalId.toString());
    }
>>>>>>> main
}