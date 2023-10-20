import React, { useEffect, useState } from 'react'

import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { cosmos } from '@ixo/impactxclient-sdk';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import styles from './GovProposals.module.scss';
import Footer from '@components/Footer/Footer';
import { useRenderScreen } from '@hooks/useRenderScreen'

export const queryProposals = () => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const { queryClient } = useQueryClient();
    const proposalStatus = cosmos.gov.v1beta1.ProposalStatus.UNRECOGNIZED
    useEffect(() => {
        const fetchProposals = async () => {
            const proposalsRequest: QueryProposalsRequest = {
                proposalStatus: proposalStatus,
                voter: "",
                depositor: "",
            }
            const response = await queryClient?.cosmos.gov.v1beta1.proposals(proposalsRequest);
            if (response?.proposals) {
                setProposals(response.proposals);
            }
        }
        fetchProposals();
    }, []);
    return proposals;
}

export const voteOptions = () => {
    const [selectedOption, setSelectedOption] = useState<'1' | '2' | '3' | '4'>();
    return { selectedOption, setSelectedOption }
}

export const SelectedOption = () => {
    const [selected, setSelected] = useState<{ proposalId: number } | null>(null);
    return { selected, setSelected }
}

export const selectedSlide = () => {
    const [slide, selectSlide] = useState(styles.swiperSlide);
    return { slide, selectSlide }
}

export const ToggleVoteBoxContainer = () => {
    const [toggleVoteActions, setToggleVoteActions] = useState(false);
    return { toggleVoteActions, setToggleVoteActions }
}

export const ToggelVotesOptions = () => {
    const { selected, setSelected } = SelectedOption();
    const { toggleVoteActions, setToggleVoteActions } = ToggleVoteBoxContainer();
    const [loading, setLoading] = useState(true);
    const [successHash, setSuccessHash] = useState<string | undefined>();
    const { currentScreen, switchToScreen } = useRenderScreen('footer');

    const toggelVotes = () => {
        if (currentScreen === 'footer') {
            switchToScreen('vote_actions');
        }
    };

    const toggelVotesClose = () => {
        if (currentScreen === 'vote_actions') {
            switchToScreen('footer');
        }
    };
    const renderScreen = () => {
        switch (currentScreen) {
            case 'footer':
                return (
                    <Footer
                        onBack={null}
                        selectVoteAction={toggelVotes}
                        onCorrect={null}
                        selectedVoteOption={''}
                        setSelectedVoteOption={null}
                    />
                )
            case 'vote_actions':
                return <VoteActions />
        }
    }
    return { renderScreen, toggelVotesClose }
} 