import React, { useState, useEffect, useContext, FC, useRef } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/Header/Header';
import Footer from '../components/Footer/Footer';
import VoteButton from '@components/VoteButton/VoteButton';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import Anchor from '@components/Anchor/Anchor';
import FilterButton from '@components/FilterButton/FilterButton';
import Thumbsup from '@icons/thumbs-up.svg';
import Thumbsdown from '@icons/thumbs-down.svg';
import NoWithVeto from '@icons/no-with-veto.svg';
import Abstain from '@icons/abstain.svg';
import Success from '@icons/success.svg';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper.min.css';
import { QueryProposalsRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { broadCastMessages } from '@utils/wallets';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import { defaultTrxFeeOption, generateVoteTrx } from '@utils/transactions';
import { cosmos } from '@ixo/impactxclient-sdk';
import { TRX_MSG } from 'types/transactions';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import IconText from '@components/IconText/IconText';
import { ViewOnExplorerButton } from '@components/Button/Button';

type RequestProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.gov_MsgVote>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.gov_MsgVote>;
    config?: StepConfigType<STEPS.gov_MsgVote>;
    header?: string;
};

// const tableRowStyle = {
//     width: '100%',
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center',
// }

interface ProposalData {
    proposer: string;
    title: string;
    description: string;
}

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


    // const handleVoteOption = (option: any) => {
    //     setSelectedOption(option);
    //     setToggleIcon(!toggleIcon);
    //     setSelectedVoteOption(option);
    //     console.log(`Selected option: ${option}`);
    // };

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

    // const toggelVotes = () => {
    //     setToggleVoteActions(!toggleVoteActions)
    // }
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

    // const signTX = async (): Promise<void> => {
    //     setLoading(true);
    //     if (selectedOption && selected) {
    //         const trxMsg: TRX_MSG[] = [
    //             generateVoteTrx({
    //                 proposalId: selected.proposalId,
    //                 voterAddress: wallet.user!.address,
    //                 option: selectedOption,
    //             }),
    //         ];
    //         const hash = await broadCastMessages(
    //             wallet,
    //             trxMsg,
    //             undefined,
    //             defaultTrxFeeOption,
    //             '',
    //             chainInfo as KEPLR_CHAIN_INFO_TYPE
    //         );
    //         if (hash) {
    //             setSuccessHash(hash);
    //             console.log('Transaction hash: ', hash);
    //         }
    //     }
    //     setLoading(false);
    // };

    // if (successHash)
    //     return (
    //         <>
    //             <Header header={header} />
    //             <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
    //                 <IconText title='Your transaction was successful!' Img={Success} imgSize={50}>
    //                     {chainInfo?.txExplorer && (
    //                         <Anchor active openInNewTab href={`${chainInfo.txExplorer.txUrl.replace(/\${txHash}/i, successHash)}`}>
    //                             <ViewOnExplorerButton explorer={chainInfo.txExplorer.name} />
    //                         </Anchor>
    //                     )}
    //                 </IconText>
    //             </main>
    //             <Footer showAccountButton={!!successHash} showActionsButton={!!successHash} selectedVoteOption={''} setSelectedVoteOption={null} />
    //         </>
    //     );

    return (
        <div style={{ position: 'relative', top: '90px' }} >
            <Header header={header} />
            <FilterButton />
            <Swiper
                // className="proposals-swiper"
                className={cls(utilsStyles.main)}
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
                                <div  >
                                    <p style={{ fontSize: '7px', margin: '-5px', width: '100%', textAlign: 'center' }} >{proposalId}</p>
                                    {/* <p>{proposalStatus}</p> */}
                                    <div style={{ display: 'flex', justifyContent: 'space-evenly', textAlign: 'left' }} >
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            {/* <AiOutlineUser size={'10px'} style={{ color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black' }} /> */}
                                            <p style={{
                                                fontSize: '10px',
                                                color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black'
                                                // color: '#D1D5DB'
                                            }}>{proposerAddress ? proposerAddress : 'Error: proposer not found'}</p>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            {/* <BsHourglass size={'10px'} style={{ color: selected && selected.proposalId === proposal.proposalId ? '#D1D5DB' : 'black' }} /> */}
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
            {/* {
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
                                                    <VoteButton backgroundColor='#1DB3D3' onClick={() => handleVoteOption('1')} >
                                                        <div style={{ marginLeft: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                            <ColoredIcon icon={Thumbsup} size={17} color={ICON_COLOR.white} /><span style={{ margin: '15px' }} >Yes</span>
                                                        </div>
                                                    </VoteButton>
                                                </td>
                                            </tr>
                                            <tr style={tableRowStyle} >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#F59E0B' onClick={() => handleVoteOption('3')} >
                                                        <div style={{ marginLeft: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                            <ColoredIcon icon={Thumbsdown} size={17} color={ICON_COLOR.white} /><span style={{ margin: '15px' }} >No</span>
                                                        </div>
                                                    </VoteButton>
                                                </td>
                                            </tr>
                                            <tr style={tableRowStyle}  >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#D97706' onClick={() => handleVoteOption('4')} >
                                                        <div style={{ marginLeft: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                            <ColoredIcon icon={NoWithVeto} size={17} color={ICON_COLOR.white} /> <span style={{ margin: '15px' }} >No with veto</span>
                                                        </div>
                                                    </VoteButton>
                                                </td>
                                            </tr>
                                            <tr style={tableRowStyle} >
                                                <td style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                                                    <VoteButton backgroundColor='#9CA3AF' onClick={() => handleVoteOption('2')} >
                                                        <div style={{ marginLeft: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                            <ColoredIcon icon={Abstain} size={17} color={ICON_COLOR.white} /><span style={{ margin: '15px' }} >Abstain</span>
                                                        </div>
                                                    </VoteButton>
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
                                    selectedVoteOption={''}
                                    setSelectedVoteOption={null} />
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
                        selectedVoteOption={''}
                        setSelectedVoteOption={null} />
                )
            } */}
            <Footer
                onBack={successHash ? null : onBack}
                onBackUrl={onBack ? undefined : ''}
                // onCorrect={loading || !!successHash ? null : signTX}
                correctLabel={loading ? 'Claiming' : !successHash ? 'Claim' : undefined}
                showAccountButton={!!successHash}
                showActionsButton={!!successHash}
                selectedVoteOption={''}
                setSelectedVoteOption={null} />
        </div >
    )
}

export default Proposals