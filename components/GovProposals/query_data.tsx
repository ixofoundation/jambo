import React, { createContext, FC, useContext, useEffect, useRef, useState } from 'react'
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { cosmos } from '@ixo/impactxclient-sdk';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import Thumbsup from '@icons/thumbs-up.svg';
import Thumbsdown from '@icons/thumbs-down.svg';
import NoWithVeto from '@icons/no-with-veto.svg';
import Abstain from '@icons/abstain.svg';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import styles from './GovProposals.module.scss';
import VoteBtn from './VoteBtn';
import { WalletContext } from '@contexts/wallet';
import { generateVoteTrx } from '@utils/transactions';
import Footer from '@components/Footer/Footer';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
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
            console.log(response?.proposals);
        }
        fetchProposals();
    }, []);
    return proposals;
}

export const voteOptions = () => {
    const [selectedOption, setSelectedOption] = useState<'1' | '2' | '3' | '4'>();
    return { selectedOption, setSelectedOption }
}

export const selectedSlide = () => {
    const [slide, selectSlide] = useState(styles.swiperSlide);
    return { slide, selectSlide }
}

export const handleProposal = () => {
    const proposals = queryProposals();
    const { selectedOption, setSelectedOption } = voteOptions();
    const { slide, selectSlide } = selectedSlide();
    const [toggleVoteActions, setToggleVoteActions] = useState(false);
    const [selected, setSelected] = useState<{ proposalId: number } | null>(null);
    const { wallet } = useContext(WalletContext);
    const handleSelect = (proposalId: number) => {
        if (!toggleVoteActions) {
            const selectedProposal = proposals.find((proposal) => proposal.proposalId.toNumber() === proposalId);
            if (selectedProposal) {
                if (selected && selected.proposalId === proposalId && slide === styles.swiperSlide) {
                    selectSlide(styles.selectSlide)
                    setSelected(null);
                } else {
                    selectSlide(styles.swiperSlide)
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
    }
    return handleSelect;
}

export const SelectedOption = () => {
    const [selected, setSelected] = useState<{ proposalId: number } | null>(null);
    return { selected, setSelected }
}

type GovProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.gov_MsgVote>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.gov_MsgVote>;
    config?: StepConfigType<STEPS.gov_MsgVote>;
    header?: string;
};


export const VoteActions = () => {
    const selectedOption = voteOptions();
    const modalRef = useRef<HTMLDivElement>(null);
    const [option, setOption] = useState(selectedOption);
    const handleVoteOption = (option: any) => {
        setOption(option);
        // setToggleIcon(!toggleIcon);
        // setSelectedVoteOption(option);
        console.log(`Selected option: ${option}`);
    };
    return (
        <>
            <div
                ref={modalRef}
                className={styles.voteBtnContainer}
            >
                <table className={styles.voteTable} >
                    <tbody className={styles.voteTableBody}>
                        <tr className={styles.tableRow} >
                            <td className={styles.tableData} >
                                <VoteBtn backgroundColor='#1DB3D3' onClick={() => handleVoteOption('1')} >
                                    <div className={styles.colorIconContainer}>
                                        <ColoredIcon
                                            icon={Thumbsup}
                                            size={17}
                                            color={ICON_COLOR.white} />
                                        <span className={styles.voteSpan} >Yes</span>
                                    </div>
                                </VoteBtn>
                            </td>
                        </tr>
                        <tr className={styles.tableRow} >
                            <td className={styles.tableData} >
                                <VoteBtn backgroundColor='#F59E0B' onClick={() => handleVoteOption('3')} >
                                    <div className={styles.colorIconContainer} >
                                        <ColoredIcon
                                            icon={Thumbsdown}
                                            size={17}
                                            color={ICON_COLOR.white} />
                                        <span className={styles.voteSpan} >No</span>
                                    </div>
                                </VoteBtn>
                            </td>
                        </tr>
                        <tr className={styles.tableRow}  >
                            <td className={styles.tableData} >
                                <VoteBtn backgroundColor='#D97706' onClick={() => handleVoteOption('4')} >
                                    <div className={styles.colorIconContainer} >
                                        <ColoredIcon
                                            icon={NoWithVeto}
                                            size={17}
                                            color={ICON_COLOR.white} />
                                        <span className={styles.voteSpan} >No with veto</span>
                                    </div>
                                </VoteBtn>
                            </td>
                        </tr>
                        <tr className={styles.tableRow} >
                            <td className={styles.tableData} >
                                <VoteBtn backgroundColor='#9CA3AF' onClick={() => handleVoteOption('2')} >
                                    <div className={styles.colorIconContainer}>
                                        <ColoredIcon
                                            icon={Abstain}
                                            size={17}
                                            color={ICON_COLOR.white} />
                                        <span className={styles.voteSpan} >Abstain</span>
                                    </div>
                                </VoteBtn>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div >
        </>
    )
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