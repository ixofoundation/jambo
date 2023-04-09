import React, { FC, useState, useEffect } from 'react'
import Header from '@components/Header/Header'
import Footer from '@components/Footer/Footer'
import { StepDataType, STEPS } from 'types/steps';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import cls from 'classnames';

type GetProposalsProps = {
    data?: StepDataType<STEPS.select_and_review_proposal>;
}

const Proposals: FC<GetProposalsProps> = ({ data }) => {
    return (
        <div className="div">
            <Header />
            <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
                Hello World!
            </main>
            <Footer onBackUrl='/' backLabel='Home' />
        </div>
    )
}

export default Proposals