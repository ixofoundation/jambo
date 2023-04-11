import React, { FC, useState, useEffect } from 'react';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import { StepDataType, STEPS } from 'types/steps';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { format } from 'date-fns';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import cls from 'classnames';

// const RPC_ENDPOINT = 'https://impacthub.ixo.world/rest/cosmos/gov/v1beta1/proposals?pagination.limit=100&proposal_status=2'

const API_BASE_URL = 'https://impacthub.ixo.world';

const api = axios.create({
    baseURL: `${API_BASE_URL}/rest/cosmos/gov/v1beta1`,
});

type GetProposalsProps = {
    data?: StepDataType<STEPS.select_and_review_proposal>;
}

const Proposals: FC<GetProposalsProps> = ({ data }) => {
    const [proposals, setProposals] = useState<Proposal[]>([])

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
                    style={{ position: 'relative', top: '10px' }}
                >

                    {proposals && proposals.length > 0 ? (
                        <div>
                            {proposals.map((proposal) => (
                                <SwiperSlide
                                    key={proposal.proposal_id}
                                    style={{
                                        backgroundColor: '#EBEBEB',
                                        height: '250px',
                                        width: '300px',
                                        padding: '20px',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderRadius: '15px',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div className="div">
                                        <h1 style={{ fontSize: '12px' }} >{proposal.content.title}</h1>
                                        <p style={{ fontSize: '10px', padding: '2rem' }} >{proposal.content.description}</p>
                                    </div>
                                </SwiperSlide>

                            ))}
                        </div>
                    ) : (
                        <p>No proposals found.</p>
                    )
                    }
                </Swiper >
            </div>
            <Footer onBackUrl='/' backLabel='Home' />
        </div >
    )
}

export default Proposals