import React, { useState, useEffect, useContext, FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import Anchor from '@components/Anchor/Anchor';
import SadFace from '@icons/sad_face.svg';
import Success from '@icons/success.svg';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper.min.css';
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { broadCastMessages } from '@utils/wallets';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import styles from '@styles/stepsPages.module.scss';
import { generateVoteTrx, defaultTrxFeeOption } from '@utils/transactions';
import { cosmos } from '@ixo/impactxclient-sdk';
import { TRX_MSG } from 'types/transactions';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import IconText from '@components/IconText/IconText';
import { ViewOnExplorerButton } from '@components/Button/Button';
import { FiThumbsUp, FiThumbsDown } from 'react-icons/fi'
import { MdOutlineFrontHand } from 'react-icons/md'
import { AiOutlineQuestionCircle } from 'react-icons/ai'

type RequestProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.select_and_review_proposal>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.select_and_review_proposal>;
    config?: StepConfigType<STEPS.select_and_review_proposal>;
    header?: string;
};

interface Props {
    backgroundColor: string;
    children: React.ReactNode;
}

const VoteButton = ({ backgroundColor, children }: Props) => {
    const VoteBtnsStyle = {
        height: '50px',
        width: '70%',
        backgroundColor: backgroundColor,
        borderRadius: '30px',
        margin: '5px',
        borderStyle: 'none',
        color: 'white',
        fontSize: '15px',
        textAlign: 'left' as const,
        display: 'flex',
        alignItems: 'center'
    }

    return (
        <button style={VoteBtnsStyle}>
            {children}
        </button>
    )
}

const tableRowStyle = {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
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
    const [toggleVoteActions, setToggleVoteActions] = useState(false);
    const [successHash, setSuccessHash] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const { queryClient } = useQueryClient();
    const { wallet } = useContext(WalletContext);
    const { chainInfo } = useContext(ChainContext);

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

    const toggelVotes = () => {
        setToggleVoteActions(!toggleVoteActions)
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

    const signTX = async (): Promise<void> => {
        setLoading(true);
        const trxMsg: TRX_MSG[] = [
            generateVoteTrx({
                proposalId: '3',
                voterAddress: 'ixo1lxyxync9hn05mcure3j9rnj56llqtwzsx5j0j3',
                option: '4',
            })
        ];
        // let memo: string | undefined;
        const hash = await broadCastMessages(
            wallet,
            trxMsg,
            undefined,
            defaultTrxFeeOption,
            '',
            chainInfo as KEPLR_CHAIN_INFO_TYPE,
        );
        if (hash) {
            setSuccessHash(hash);
            console.log("Transaction hash: ", hash);
        }
        setLoading(false);
    };

    useEffect(() => {
        signTX()
    }, [])

    if (successHash)
        return (
            <>
                <Header header={header} />

                <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
                    <IconText title='Your transaction was successful!' Img={Success} imgSize={50}>
                        {chainInfo?.txExplorer && (
                            <Anchor active openInNewTab href={`${chainInfo.txExplorer.txUrl.replace(/\${txHash}/i, successHash)}`}>
                                <ViewOnExplorerButton explorer={chainInfo.txExplorer.name} />
                            </Anchor>
                        )}
                    </IconText>
                </main>

                <Footer showAccountButton={!!successHash} showActionsButton={!!successHash} />
            </>
        );

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
                    <>
                        {
                            toggleVoteActions ? (
                                <div
                                    style={{
                                        top: '310px',
                                        zIndex: 1,
                                        position: 'fixed',
                                        backgroundColor: '#F0F0F0',
                                        width: '100%',
                                        height: '20rem',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <table style={{ width: '100%', display: 'relative', justifyContent: 'center', alignItems: 'center' }} >
                                        <tr><button onClick={toggelVotes} >CLOSE</button></tr>
                                        <tr style={tableRowStyle}><VoteButton backgroundColor='#1DB3D3' >< FiThumbsUp />Yes</VoteButton></tr>
                                        <tr style={tableRowStyle} ><VoteButton backgroundColor='#F59E0B' ><FiThumbsDown />No</VoteButton></tr>
                                        <tr style={tableRowStyle}  ><VoteButton backgroundColor='#D97706' ><MdOutlineFrontHand />No with veto</VoteButton></tr>
                                        <tr style={tableRowStyle} ><VoteButton backgroundColor='#9CA3AF' ><AiOutlineQuestionCircle />Abstain</VoteButton></tr>
                                    </table>
                                </div>
                            ) : (
                                <Footer
                                    onBack={successHash ? null : onBack}
                                    selectVoteAction={toggelVotes}
                                    onCorrect={loading || !!successHash ? null : signTX}
                                />
                            )
                        }

                    </>

                ) : (

                    <Footer
                        onBack={successHash ? null : onBack}
                        onBackUrl={onBack ? undefined : ''}
                        onCorrect={loading || !!successHash ? null : signTX}
                        correctLabel={loading ? 'Claiming' : !successHash ? 'Claim' : undefined}
                        showAccountButton={!!successHash}
                        showActionsButton={!!successHash}
                    />
                )
            }

        </div >
    )
}

export default Proposals