import React, { FC } from 'react';
import Header from '@components/Header/Header';
import 'swiper/swiper.min.css';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import FilterButton from '@components/FilterButton/FilterButton';
import GovProposals from '@components/GovProposals/GovProposals';

type RequestProposalsProps = {
    onSuccess: (data: StepDataType<STEPS.gov_MsgVote>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.gov_MsgVote>;
    config?: StepConfigType<STEPS.gov_MsgVote>;
    header?: string;
};

const Proposals: FC<RequestProposalsProps> = ({ header }) => {

    return (
        <div style={{ position: 'relative', top: '90px' }} >
            <Header header={header} />
            <FilterButton />
            <GovProposals />
        </div >
    )
}

export default Proposals