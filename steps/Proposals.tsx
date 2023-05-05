import React, { useState, useEffect, useContext, FC } from 'react';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper.min.css';
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import styles from '@styles/stepsPages.module.scss';
import { generateVoteTrx } from '@utils/transactions';
import { cosmos } from '@ixo/impactxclient-sdk';
import { TRX_MSG } from 'types/transactions';

type RequestProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.select_and_review_proposal>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.select_and_review_proposal>;
    config?: StepConfigType<STEPS.select_and_review_proposal>;
    header?: string;
};

const VoteBtns = {
    height: '50px',
    width: '50px',
    borderRadius: '100%'
}

type Proposal = {
    proposalId: number;
    proposalType: string;
    title: string;
    description: string;
    status: string;
};

const Proposals: FC<RequestProposalsProps> = ({ onSuccess, onBack, config, data, header }) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selected, setSelected] = useState(false);
    const { queryClient } = useQueryClient();

    // useEffect(() => {
    //     const castVote = async () => {
    //         const proposalId = '3';
    //         const voterAddress = 'ixo1rkyhrz6qz6ydgadwyqjs7cf6ezvz8j2sht0uxg';
    //         const option = 'VOTE_OPTION_YES';
    //         const trxMsg = generateVoteTrx({ proposalId, voterAddress, option });
    //         console.log(trxMsg)
    //     }
    //     castVote()
    // }, [])

    // const handleSelect = async (proposalId: number) => {
    //     const selectedProposal = proposals.find((proposal) => proposal.proposalId === proposalId);
    //     if (selectedProposal) {
    //         setSelectedValue(!selectedValue);
    //     } else {
    //         console.log(`${proposalId}`);
    //     }
    // }

    const handleSelect = (proposalId: number) => {
        const selectedProposal = proposals.find((proposal) => proposal.proposalId === proposalId);
        if (selectedProposal) {
            if (selectedProposal === selected) {
                setSelected(null);
            } else {
                setSelected(selectedProposal)
            }
        }
        console.log(proposalId.toString())
    }
    

    useEffect(() => {
        const fetchProposals = async () => {
            const proposalsRequest: QueryProposalsRequest = {
                proposalStatus: "",
                voter: "",
                depositor: "",
            }
            const response = await queryClient?.cosmos.gov.v1beta1.proposals(proposalsRequest);
            console.log(response?.proposals)
            setProposals(response?.proposals)
        }
        fetchProposals()
    }, [])

    return (
        <div className="div">
            <Header header={header} />
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                <button>Filter</button>
            </div>
            <div className="div">
                <Swiper
                    className="proposals-swiper"
                    spaceBetween={10}
                    centeredSlides
                    slidesPerView='auto'
                    initialSlide={5}
                >
                    {proposals && proposals.length > 0 ? (
                        <div>
                            {proposals.map((proposal) => (
                                <SwiperSlide
                                    key={proposal.proposalId.toString()}
                                    onClick={() => handleSelect(proposal.proposalId)}
                                    // className={selectedValue === proposal.proposal_id ? 'selected' : ''}
                                    style={{
                                        backgroundColor: '#EBEBEB',
                                        height: selected && selected.proposalId === proposal.proposalId ? '400px' : '300px',
                                        width: '300px',
                                        padding: '20px',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        borderRadius: '15px',
                                        overflow: 'hidden',
                                        borderStyle: selected && selected.proposalId === proposal.proposalId ? 'solid' : '',
                                        borderColor: 'lightblue'
                                    }}

                                >
                                    <form className={styles.stepsForm} autoComplete='none' >
                                        <div className="div">
                                            <p
                                                style={{
                                                    fontSize: '10px',
                                                    height: selected ? '15rem' : '10rem',
                                                    overflow: 'hidden',
                                                    textAlign: 'left',
                                                    width: '16rem',
                                                    overflowY: 'auto',
                                                }}
                                            >
                                                Proposal Status code: {proposal.status}
                                            </p>
                                        </div>
                                    </form>
                                </SwiperSlide>

                            ))}
                        </div>
                    ) : (
                        <p>Loading Proposals...</p>
                    )
                    }
                </Swiper >
            </div>
            {
                selected ? (
                    <Footer
                        onBack={onBack}
                        onBackUrl={onBack ? undefined : ''}
                    />
                ) : (

                    <Footer
                        onBack={onBack}
                        onBackUrl={onBack ? undefined : ''}
                    />
                )
            }

        </div >
    )
}

export default Proposals