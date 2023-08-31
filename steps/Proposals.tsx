import React, { useState, useEffect, useContext, FC, useRef } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/Header/Header';
import Footer from '../components/Footer/Footer';
import { Proposal } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/gov';
import Anchor from '@components/Anchor/Anchor';
import Success from '@icons/success.svg';
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
import FilterButton from '@components/FilterButton/FilterButton';
import GovProposals from '@components/GovProposals/GovProposals';

type RequestProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.gov_MsgVote>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.gov_MsgVote>;
    config?: StepConfigType<STEPS.gov_MsgVote>;
    header?: string;
};

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
                <Footer showAccountButton={!!successHash} showActionsButton={!!successHash} selectedVoteOption={''} setSelectedVoteOption={null} />
            </>
        );

    return (
        <div style={{ position: 'relative', top: '90px' }} >
            <Header header={header} />
            <FilterButton />
            <GovProposals />
        </div >
    )
}

export default Proposals