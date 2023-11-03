import { FC, useState } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import OnboardingLanguage from '@components/SupaMotoScreens/OnboardingLanguage';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';

type SupaMotoOnboardingProps = {
    onSuccess: (data?: StepDataType<STEPS.onboarding>) => void;
    onBack?: () => void;
    data?: StepDataType<STEPS.onboarding>;
    config: StepConfigType<STEPS.onboarding>;
    loading?: boolean;
};

const SupaMotoOnboarding: FC<SupaMotoOnboardingProps> = ({ loading = false, onSuccess, onBack }) => {
    return (
        <>
            <Header />
            <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
                <div className={utilsStyles.spacer3} />
                {loading ? (
                    <Loader />
                ) : (
                    <div className={styles.stepContainer} >
                        <OnboardingLanguage />
                    </div>
                )}
                <div className={utilsStyles.spacer3} />
            </main>

        </>
    );
};

export default SupaMotoOnboarding;
