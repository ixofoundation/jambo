import React, { useState, useEffect, useContext, FC } from 'react';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper.min.css';
import { STEPS, StepDataType } from 'types/steps';
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import useQueryClient from '@hooks/useQueryClient';
import { generateVoteTrx } from '@utils/transactions';
import { cosmos } from '@ixo/impactxclient-sdk';

type ProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.select_and_review_proposal>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.select_and_review_proposal>;
    header?: string;
};

const BtnStyles = {
    backgroundColor: '#1DB3D3',
    height: '30px',
    width: '90px',
    borderRadius: '15px',
    borderStyle: 'none',
    color: 'white'
}

const VoteBtns = {
    height: '50px',
    width: '50px',
    borderRadius: '100%'
}

const Proposals: FC<ProposalsProps> = ({ onSuccess, onBack, data, header }) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selected, setSelected] = useState(false);
    const [selectedValue, setSelectedValue] = useState(false);

    const { queryClient } = useQueryClient();

    useEffect(() => {
        const castVote = async () => {
            const proposalId = '1';
            const voterAddress = 'ixo1rkyhrz6qz6ydgadwyqjs7cf6ezvz8j2sht0uxg';
            const option = 'VOTE_OPTION_YES';
            const trxMsg = generateVoteTrx({ proposalId, voterAddress, option });

            const txBody = cosmos.tx.v1beta1.TxBody.fromJSON({
                messages: [trxMsg],
                memo: ''
            });

            const client = cosmos.tx.v1beta1.broadcastModeToJSON(txBody);
            delete client.mode;
            console.log(client)
        }
        castVote()
    }, [])

    const handleSelect = async (proposalId: number) => {
        const selectedProposal = proposals.find((proposal) => proposal.proposalId === proposal.proposalId);
        if (selectedProposal) {
            setSelectedValue(!selectedValue);
        } else {
            console.log(`${proposalId}`);
        }
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
            <Header />
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
                                    key={proposal.proposalId}
                                    onClick={() => handleSelect(proposal.proposal_id)}
                                    // className={selectedValue === proposal.proposal_id ? 'selected' : ''}
                                    style={{
                                        backgroundColor: '#EBEBEB',
                                        height: selected ? '400px' : '300px',
                                        width: '300px',
                                        padding: '20px',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        borderRadius: '15px',
                                        overflow: 'hidden',
                                        borderStyle: selectedValue ? 'solid' : '',
                                        borderColor: 'lightblue'
                                    }}

                                >
                                    <div className="div">
                                        <h1 style={{ fontSize: '11px', textAlign: 'left' }} >{proposal.content.title}</h1>

                                        {/* <div style={{ width: '100%', height: '5px', backgroundColor: '#f0f0f0', borderRadius: '10px' }}>
                                            <div style={{ width: `${yesPercentage}%`, height: '100%', backgroundColor: 'blue', borderRadius: '10px' }}></div>
                                        </div> */}

                                        {/* <p>{proposal.final_tally_result.yes}</p> */}
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
                                            {proposal.status}
                                        </p>
                                        {/* <div className="div">{proposal.depositEndTime?.nanos}</div> */}
                                        <div
                                            style={{

                                                display: 'flex',
                                                justifyContent: 'space-evenly',
                                                alignItems: 'center',
                                                position: 'relative',
                                                height: '70px',
                                                bottom: '50px',
                                                backgroundColor: '#EBEBEB'
                                            }}
                                        >
                                            <button style={BtnStyles} onClick={() => setSelected(!selected)} >Actions</button>
                                            <button style={BtnStyles} >Resources</button>
                                        </div>
                                    </div>
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
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-evenly',
                            position: 'fixed',
                            width: '100%',
                            bottom: '20px',
                        }}
                    >
                        <button style={VoteBtns}>YES</button>
                        <button style={VoteBtns}>MORE</button>
                        <button style={VoteBtns}>NO</button>
                    </div>
                ) : (

                    <Footer onBackUrl='/' backLabel='Home' />
                )
            }

        </div >
    )
}

export default Proposals