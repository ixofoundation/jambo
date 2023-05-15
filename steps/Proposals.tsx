import React, { useState, useEffect, useContext, FC, useRef } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/Header/Header';
// import Footer from '@components/Footer/Footer';
import styles from '../components/Footer/Footer.module.scss';
import styles1 from '@styles/stepsPages.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
// import Anchor from '@components/Anchor/Anchor';
import ArrowRight from '@icons/arrow_right.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import Correct from '@icons/correct.svg';
import Wallet from '@icons/wallet.svg';
import Touch from '@icons/touch.svg';
import Dots from '@icons/vertical_dots.svg'
import { backRoute, replaceRoute } from '@utils/router';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import { useRouter } from 'next/router';
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
// import styles from '@styles/stepsPages.module.scss';
import { defaultTrxFeeOption } from '@utils/transactions';
import { cosmos } from '@ixo/impactxclient-sdk';
import { TRX_MSG } from 'types/transactions';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import IconText from '@components/IconText/IconText';
import { ViewOnExplorerButton } from '@components/Button/Button';
import { FiThumbsUp, FiThumbsDown } from 'react-icons/fi';
import { MdOutlineFrontHand } from 'react-icons/md';
import { AiOutlineQuestionCircle, AiOutlineUser } from 'react-icons/ai';
import { BsHourglass } from 'react-icons/bs';
import { HiOutlineDotsVertical } from 'react-icons/hi'
import { IoHandRightOutline } from 'react-icons/io5'

type RequestProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.select_and_review_proposal>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.select_and_review_proposal>;
    config?: StepConfigType<STEPS.select_and_review_proposal>;
    header?: string;
};

type FooterProps = {
    onBackUrl?: string;
    onBack?: (() => void) | null;
    backLabel?: string;
    onCorrect?: (() => void) | null;
    correctLabel?: string;
    onForward?: (() => void) | null;
    forwardLabel?: string;
    showAccountButton?: boolean;
    showActionsButton?: boolean;
    selectVoteAction?: (() => void) | null;
};

interface VoteBtnProps {
    backgroundColor: string;
    children: React.ReactNode;
    onClick: () => void
}

const VoteButton = ({ backgroundColor, children, onClick }: VoteBtnProps) => {
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
        <button style={VoteBtnsStyle} onClick={onClick} >
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

interface ProposalData {
    proposer: string;
    title: string;
    description: string;
}

// type Proposal = {
//     proposalId: number;
//     proposalType: string;
//     title: string;
//     description: string;
//     status: string;
// };

const Proposals: FC<RequestProposalsProps> = ({ onSuccess, onBack, config, data, header }) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selected, setSelected] = useState<{ proposalId: number } | null>(null);
    const [selectedOption, setSelectedOption] = useState<'1' | '2' | '3' | '4'>();
    const [selectedVoteOption, setSelectedVoteOption] = useState('');
    const [toggleVoteActions, setToggleVoteActions] = useState(false);
    const [successHash, setSuccessHash] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [toggleIcon, setToggleIcon] = useState(false);
    const [filterStatus, setFilterStatus] = useState("all");
    const { queryClient } = useQueryClient();
    const { wallet } = useContext(WalletContext);
    const { chainInfo } = useContext(ChainContext);
    console.log(filterStatus);
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

    const Footer = ({
        onBack,
        // backLabel,
        onBackUrl,
        onCorrect,
        // correctLabel,
        onForward,
        // forwardLabel,
        showAccountButton,
        showActionsButton,
        selectVoteAction,
    }: FooterProps) => {
        // const { width } = useWindowDimensions();
        const { asPath } = useRouter();

        return (
            <footer className={styles.footer}>
                {showAccountButton && (
                    <Anchor href='/account' active={asPath !== '/account'}>
                        <ButtonRound
                            size={BUTTON_ROUND_SIZE.large}
                            color={/^\/account/i.test(asPath) ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
                        >
                            <ColoredIcon
                                icon={Wallet}
                                size={24}
                                color={/^\/account/i.test(asPath) ? ICON_COLOR.white : ICON_COLOR.primary}
                            />
                            {/* {!!width && width > 425 && <p className={styles.label}>Account</p>} */}
                        </ButtonRound>
                    </Anchor>
                )}
                {showActionsButton && (
                    <Anchor href='/' active={asPath !== '/'}>
                        <ButtonRound
                            size={BUTTON_ROUND_SIZE.large}
                            color={asPath === '/' ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
                        >
                            <ColoredIcon icon={Touch} size={24} color={asPath === '/' ? ICON_COLOR.white : ICON_COLOR.primary} />
                        </ButtonRound>
                    </Anchor>
                )}
                {(onBack || onBackUrl || onBackUrl === '') && (
                    <ButtonRound
                        onClick={() => (onBack ? onBack() : onBackUrl === '' ? backRoute() : replaceRoute(onBackUrl!))}
                        color={BUTTON_ROUND_COLOR.lightGrey}
                        size={BUTTON_ROUND_SIZE.large}
                    >
                        <ColoredIcon icon={ArrowLeft} size={24} color={ICON_COLOR.primary} />
                        {/* {!!width && width > 425 && <p className={styles.label}>{backLabel ?? 'Back'}</p>} */}
                    </ButtonRound>
                )}
                {selectVoteAction !== undefined && (
                    <ButtonRound
                        color={
                            selectedVoteOption === '1' ? BUTTON_ROUND_COLOR.primary :
                                selectedVoteOption === '2' ? BUTTON_ROUND_COLOR.grey :
                                    selectedVoteOption === '3' ? BUTTON_ROUND_COLOR.tertiary :
                                        selectedVoteOption === '4' ? BUTTON_ROUND_COLOR.tertiary :
                                            BUTTON_ROUND_COLOR.lightGrey
                        }
                        onClick={selectVoteAction ?? undefined}
                        size={BUTTON_ROUND_SIZE.large}
                    >
                        {selectedVoteOption === '1' && <FiThumbsUp style={{ width: '24px', height: '24px' }} />}
                        {selectedVoteOption === '2' && <AiOutlineQuestionCircle style={{ width: '24px', height: '24px' }} />}
                        {selectedVoteOption === '3' && <FiThumbsDown style={{ width: '24px', height: '24px' }} />}
                        {selectedVoteOption === '4' && <IoHandRightOutline style={{ width: '24px', height: '24px' }} />}
                        {!selectedVoteOption && <HiOutlineDotsVertical color={'#1DB3D3'} size={'24px'} />}
                    </ButtonRound>
                )}
                {onCorrect !== undefined && (
                    <ButtonRound
                        color={onCorrect ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
                        onClick={onCorrect ?? undefined}
                        size={BUTTON_ROUND_SIZE.large}
                    >
                        <Correct width='24px' height='24px' />
                        {/* {!!width && width > 425 && <p className={styles.label}>{correctLabel ?? 'Next'}</p>} */}
                    </ButtonRound>
                )}
                {onForward !== undefined && (
                    <ButtonRound
                        color={onForward ? undefined : BUTTON_ROUND_COLOR.lightGrey}
                        onClick={onForward ?? undefined}
                        size={BUTTON_ROUND_SIZE.large}
                    >
                        <ArrowRight width='24px' height='24px' />
                        {/* {!!width && width > 425 && <p className={styles.label}>{forwardLabel ?? 'Done'}</p>} */}
                    </ButtonRound>
                )}
            </footer>
        );
    };

    const modalRef = useRef<HTMLDivElement>(null);
    const proposalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutsideModal = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node) &&
                proposalRef.current &&
                !proposalRef.current.contains(event.target as Node)
            ) {
                setToggleVoteActions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsideModal);
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideModal);
        };
    }, []);


    const handleVoteOption = (option: any) => {
        setSelectedOption(option);
        setToggleIcon(!toggleIcon);
        setSelectedVoteOption(option);
        console.log(`Selected option: ${option}`);
    };

    const handleSelect = (proposalId: number) => {
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
    }

    const toggelVotes = () => {
        setToggleVoteActions(!toggleVoteActions)
    }
    const toggelVotesClose = () => {
        setToggleVoteActions(false)
    }

    useEffect(() => {
        const fetchProposals = async () => {
            const proposalsRequest: QueryProposalsRequest = {
                proposalStatus: "",
                voter: "",
                depositor: "",
            }
            try {
                const response = await queryClient?.cosmos.gov.v1beta1.proposals(proposalsRequest);
                if (response && response.proposals) {
                    console.log(response.proposals);
                    const proposalsArray: ProposalData[] = [];
                    response.proposals.forEach((proposal) => {
                        const proposalContentBytes = proposal.content?.value;
                        const proposalType = proposal.content?.typeUrl.split('/')[1];
                        if (proposalType === 'cosmos.gov.v1beta1.TextProposal') {
                            const proposalContent = cosmos.gov.v1beta1.TextProposal.decode(proposalContentBytes);
                            const proposalTitle = proposalContent.title;
                            const proposalDescription = proposalContent.description;
                            const proposer = proposal.proposer?.address || '';
                            const proposalData: ProposalData = {
                                proposer: proposer,
                                title: proposalTitle,
                                description: proposalDescription,
                            };
                            proposalsArray.push(proposalData);
                        }
                    });
                    console.log(proposalsArray);
                    setProposals(response.proposals);
                }
            } catch (error) {
                console.log("Error fetching proposals:", error);
            }
        }
        fetchProposals()
    }, [])

    const generateVoteTrx = ({
        proposalId,
        voterAddress,
        option: selectedOption,
    }: {
        proposalId: number;
        voterAddress: string;
        option: '1' | '2' | '3' | '4';
    }): TRX_MSG => ({
        typeUrl: '/cosmos.gov.v1beta1.MsgVote',
        value: cosmos.gov.v1beta1.MsgVote.fromPartial({
            proposalId: proposalId.toString(),
            voter: voterAddress.toString(),
            option: selectedOption,
        }),
    });

    const signTX = async (): Promise<void> => {
        setLoading(true);
        if (selectedOption && selected) {
            const trxMsg: TRX_MSG[] = [
                generateVoteTrx({
                    proposalId: selected.proposalId,
                    voterAddress: wallet.user!.address,
                    option: selectedOption,
                }),
            ];
            // let memo: string | undefined;
            const hash = await broadCastMessages(
                wallet,
                trxMsg,
                undefined,
                defaultTrxFeeOption,
                '',
                chainInfo as KEPLR_CHAIN_INFO_TYPE
            );
            if (hash) {
                setSuccessHash(hash);
                console.log('Transaction hash: ', hash);
            }
        }
        setLoading(false);
    };

    // useEffect(() => {
    //     signTX()
    // }, [])

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
                <button style={{ backgroundColor: '#E5E7EB', borderRadius: '20px', margin: '1px', borderStyle: 'none', height: '2rem', width: '5rem', color: 'white' }} onClick={() => {
                    switch (filterStatus) {
                        case "all":
                            setFilterStatus("deposit");
                            break;
                        case "deposit":
                            setFilterStatus("voting");
                            break;
                        case "voting":
                            setFilterStatus("passed");
                            break;
                        case "passed":
                            setFilterStatus("rejected");
                            break;
                        case "rejected":
                            setFilterStatus("failed");
                            break;
                        case "failed":
                            setFilterStatus("unrecognized");
                            break;
                        case "unrecognized":
                            setFilterStatus("all");
                            break;
                    }
                }}>Filter</button>
            </div>
            <Swiper
                className="proposals-swiper"
                spaceBetween={15}
                centeredSlides
                slidesPerView='auto'
                initialSlide={5}
                onClick={toggelVotesClose}
            >
                {proposals.filter(proposal => {
                    switch (filterStatus) {
                        case "deposit":
                            return proposal.status === cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD;
                        case "voting":
                            return proposal.status === cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD;
                        case "passed":
                            return proposal.status === cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_PASSED;
                        case "rejected":
                            return proposal.status === cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_REJECTED;
                        case "failed":
                            return proposal.status === cosmos.gov.v1beta1.ProposalStatus.PROPOSAL_STATUS_FAILED;
                        case "unrecognized":
                            return proposal.status === cosmos.gov.v1beta1.ProposalStatus.UNRECOGNIZED;
                        default:
                            return true;
                    }
                }).map(proposal => {
                    if (proposal.content?.typeUrl.split('/')[1] === 'cosmos.gov.v1beta1.TextProposal') {
                        const proposalContent = cosmos.gov.v1beta1.TextProposal.decode(proposal.content.value);
                        const proposalTitle = proposalContent.title;
                        const proposalDescription = proposalContent.description;
                        const proposerAddress = proposal.proposer?.address;
                        const submitTime = proposal.submitTime;
                        const proposalId = proposal.proposalId.toNumber();
                        const proposalStatus = proposal.status.toString();

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
                                key={proposal.proposalId}
                                onClick={() => handleSelect(proposal.proposalId)}
                                ref={proposalRef}
                                style={{
                                    backgroundColor: '#EBEBEB',
                                    height: selected && selected.proposalId === proposal.proposalId ? '400px' : '300px',
                                    width: '290px',
                                    padding: '20px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    borderRadius: '15px',
                                    overflow: 'hidden',
                                    borderStyle: selected && selected.proposalId === proposal.proposalId ? 'solid' : '',
                                    borderColor: 'lightblue'
                                }}
                            >
                                <div>
                                    <p style={{ fontSize: '7px', margin: '-5px', width: '100%', textAlign: 'center' }} >{proposalId}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-evenly', textAlign: 'left' }} >
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <AiOutlineUser size={'10px'} style={{ color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black' }} />
                                            <p style={{
                                                fontSize: '10px',
                                                color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black'
                                                // color: '#D1D5DB'
                                            }}>{proposerAddress ? proposerAddress : 'Error: proposer not found'}</p>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <BsHourglass size={'10px'} style={{ color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black' }} />
                                            <p style={{
                                                fontSize: '10px',
                                                color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black'
                                                // color: '#D1D5DB'
                                            }}>
                                                {submitTime ? new Date(submitTime.seconds.toNumber() * 1000 + submitTime.nanos / 1000000).toLocaleString() : 'Error: submit time not found'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: "#f2f2f2", borderRadius: '50px', height: '10px' }}>
                                        <div style={{ background: `linear-gradient(90deg, #1DB3D3 ${yesPercentage}%, #F59E0B ${noPercentage}%, #F1C40F ${abstainPercentage}%, #8E44AD ${noWithVetoPercentage}%)`, borderRadius: '50px', height: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div style={{ minWidth: '20px', width: `${yesPercentage}%`, backgroundColor: '#1DB3D3', borderRadius: '50px 0px 0px 50px', height: '10px', fontSize: '7px' }}>{finalTallyYes || 0}</div>
                                                <div style={{ minWidth: '20px', width: `${noPercentage}%`, backgroundColor: '#F59E0B', height: '10px', fontSize: '7px' }}>{finalTallyNo || 0}</div>
                                                <div style={{ minWidth: '20px', width: `${abstainPercentage}%`, backgroundColor: '#9CA3AF', height: '10px', fontSize: '7px' }}>{finalTallyAbstain || 0}</div>
                                                <div style={{ minWidth: '20px', width: `${noWithVetoPercentage}%`, backgroundColor: '#D97706', borderRadius: '0px 50px 50px 0px', height: '10px', fontSize: '7px' }}>{finalTallyVeto || 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* <p>{proposalStatus}</p> */}
                                    <h3 style={{ fontSize: '14px' }} >{proposalTitle}</h3>
                                    <p style={{
                                        fontSize: '12px',
                                    }} >{proposalDescription}</p>
                                </div>
                            </SwiperSlide>
                        );
                    }
                    return null;
                })}
            </Swiper>
            {
                selected ? (
                    <>
                        {
                            toggleVoteActions ? (
                                <div
                                    ref={modalRef}
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
                                    <table style={{ width: '100%', display: 'block', justifyContent: 'center', alignItems: 'center' }} >
                                        <tbody style={{ width: '100%', display: 'block', justifyContent: 'center', alignItems: 'center' }}>
                                            <tr style={tableRowStyle} >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#1DB3D3' onClick={() => handleVoteOption('1')} >< FiThumbsUp />Yes</VoteButton>
                                                </td>
                                            </tr>
                                            <tr style={tableRowStyle} >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#F59E0B' onClick={() => handleVoteOption('3')} ><FiThumbsDown />No</VoteButton>
                                                </td>
                                            </tr>
                                            <tr style={tableRowStyle}  >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#D97706' onClick={() => handleVoteOption('4')} ><IoHandRightOutline />No with veto</VoteButton>
                                                </td>
                                            </tr>
                                            <tr style={tableRowStyle} >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#9CA3AF' onClick={() => handleVoteOption('2')} ><AiOutlineQuestionCircle />Abstain</VoteButton>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Footer
                                    onBack={successHash ? null : onBack}
                                    selectVoteAction={toggelVotes}
                                    onCorrect={!!successHash || !selectedOption ? null : signTX}
                                />
                            )
                        }

                    </>

                ) : (

                    <Footer
                        onBack={successHash ? null : onBack}
                        onBackUrl={onBack ? undefined : ''}
                        // onCorrect={loading || !!successHash ? null : signTX}
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