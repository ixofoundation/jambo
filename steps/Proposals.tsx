import React, { FC, useState, useEffect } from 'react';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { StepDataType, STEPS } from 'types/steps';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper.min.css';

// const RPC_ENDPOINT = 'https://impacthub.ixo.world/rest/cosmos/gov/v1beta1/proposals?pagination.limit=100&proposal_status=2'

const API_BASE_URL = 'https://impacthub.ixo.world';

const api = axios.create({
    baseURL: `${API_BASE_URL}/rest/cosmos/gov/v1beta1`,
});

type GetProposalsProps = {
    data?: StepDataType<STEPS.select_and_review_proposal>;
    proposalId: string;
    proposal: Proposal[];
}

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

interface Proposal {
    id: number;
    proposal_id: string;
}

const Proposals: FC<GetProposalsProps> = () => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selected, setSelected] = useState(false);
    const [selectedValue, setSelectedValue] = useState(false);

    const handleSelect = (proposal_id: number) => {
        const selectedProposal = proposals.find((proposal) => proposal.id === proposal_id);
        if (selectedProposal) {
            setSelectedValue(!selectedValue);
        } else {
            console.log(`${proposal_id}`);
        }
    }

    useEffect(() => {
        const fetchProposals = async () => {
            try {
                const response = await api.get('/proposals');
                setProposals(response.data.proposals);
                console.log(response.data.proposals)
            } catch (error) {
                console.error(error);
            }
        };
        fetchProposals();
    }, [])

    if (!proposals || !proposals.final_tally_result) {
        // Handle the case where proposals or final_tally_result is undefined
        console.error('Error: Proposals or final_tally_result is undefined.');
    } else {
        const totalVotes = (proposals.final_tally_result.abstain ?? 0) + (proposals.final_tally_result.no ?? 0) + (proposals.final_tally_result.no_with_veto ?? 0) + (proposals.final_tally_result.yes ?? 0);
        const yesVotes = proposals.final_tally_result.yes ?? 0;
        const yesPercentage = totalVotes ? (yesVotes / (totalVotes - proposals.final_tally_result.abstain)) * 100 : 0;
        // Update the progress bar using the yesPercentage value
    }

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
                                    key={proposal.proposal_id}
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

                                        <div style={{ width: '100%', height: '5px', backgroundColor: '#f0f0f0', borderRadius: '10px' }}>
                                            <div style={{ width: `${yesPercentage}%`, height: '100%', backgroundColor: 'blue', borderRadius: '10px' }}></div>
                                        </div>

                                        <p>{proposal.final_tally_result.yes}</p>
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
                                            {proposal.content.description}
                                        </p>
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