import { FC, useState } from 'react';
import cls from 'classnames';

import useQueryClient from '@hooks/useQueryClient';
import HourGlass from '@assets/icons/hourglass.svg';
import Depositor from '@assets/icons/depositor.svg';
import { cosmos } from '@ixo/impactxclient-sdk';
import { Swiper, SwiperSlide } from 'swiper/react';
import utilsStyles from '@styles/utils.module.scss';
import styles from './GovProposals.module.scss';
import { queryProposals } from './query_data';
import VoteStats from '@components/VoteStats/VoteStats';

type Props = {
    loading?: boolean;
    signedIn?: boolean;
};


const GovProposals2: FC<Props> = () => {
    const [slide, selectSlide] = useState(styles.swiperSlide);
    const proposals = queryProposals();
    const useSelectSlide = () => {
        if (slide === styles.swiperSlide) {
            selectSlide(styles.selectSlide)
        } else {
            selectSlide(styles.swiperSlide)
        }
    }
    return (
        <ul>
            <Swiper
                className={cls(utilsStyles.main)}
                spaceBetween={15}
                centeredSlides
                slidesPerView='auto'
                initialSlide={1}
            >
                {proposals.map(proposal => {
                    if (proposal.content?.typeUrl.split('/')[1] === 'cosmos.gov.v1beta1.TextProposal') {
                        const decodeContent = cosmos.gov.v1beta1.TextProposal.decode(proposal.content.value);
                        const proposalId = proposal.proposalId.toNumber();
                        const submitTime = proposal.submitTime;
                        const finalTallyYes = Number(proposal.finalTallyResult?.yes);
                        const finalTallyNo = Number(proposal.finalTallyResult?.no);
                        const finalTallyAbstain = Number(proposal.finalTallyResult?.abstain);
                        const finalTallyVeto = Number(proposal.finalTallyResult?.noWithVeto);
                        const total = (finalTallyYes || 0) + (finalTallyNo || 0) + (finalTallyAbstain || 0) + (finalTallyVeto || 0);
                        const yesPercentage = (finalTallyYes / total) * 100;
                        const noPercentage = (finalTallyNo / total) * 100;
                        const abstainPercentage = (finalTallyAbstain / total) * 100;
                        const noWithVetoPercentage = (finalTallyVeto / total) * 100;
                        return (
                            <SwiperSlide
                                className={slide}
                                onClick={useSelectSlide}
                                key={proposal.proposalId.toString()}
                            >
                                <div>
                                    <div className={styles.slideHead}>
                                        <p className={styles.proposalTime} >
                                            <Depositor />Despositor?...
                                        </p>
                                        <p className={styles.proposalTime} >
                                            <HourGlass />
                                            {submitTime ?
                                                (() => {
                                                    const submitTimeMillis = submitTime.seconds.toNumber()
                                                        * 1000 + submitTime.nanos / 1000000;
                                                    const submitDate = new Date(submitTimeMillis);
                                                    const hours = submitDate.getHours();
                                                    const minutes = submitDate.getMinutes();
                                                    const seconds = submitDate.getSeconds();
                                                    const milliseconds = submitDate.getMilliseconds();
                                                    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
                                                })() :
                                                'Error: submit time not found'
                                            }
                                        </p>
                                    </div>

                                    <div className={styles.statusBar} >
                                        <div
                                            style={{
                                                background: `linear-gradient(90deg, #1DB3D3 ${yesPercentage}%, #F59E0B ${noPercentage}%, #F1C40F ${abstainPercentage}%, #8E44AD ${noWithVetoPercentage}%)`,
                                                borderRadius: '50px',
                                                height: '10px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div style={{ minWidth: '20px', width: `${yesPercentage}%`, backgroundColor: '#1DB3D3', borderRadius: '50px 0px 0px 50px', height: '10px', fontSize: '7px' }}>{finalTallyYes || 0}</div>
                                                <div style={{ minWidth: '20px', width: `${noPercentage}%`, backgroundColor: '#F59E0B', height: '10px', fontSize: '7px' }}>{finalTallyNo || 0}</div>
                                                <div style={{ minWidth: '20px', width: `${abstainPercentage}%`, backgroundColor: '#9CA3AF', height: '10px', fontSize: '7px' }}>{finalTallyAbstain || 0}</div>
                                                <div style={{ minWidth: '20px', width: `${noWithVetoPercentage}%`, backgroundColor: '#D97706', borderRadius: '0px 50px 50px 0px', height: '10px', fontSize: '7px' }}>{finalTallyVeto || 0}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className={styles.proposalTitle}>
                                            #{proposalId}{decodeContent.title}
                                        </p>
                                        <p className={styles.proposalDescription}
                                        >{decodeContent.description}</p>
                                    </div>
                                </div>
                            </SwiperSlide>
                        );
                    }

                })}
            </Swiper>
        </ul>
    );
};

export default GovProposals2;

