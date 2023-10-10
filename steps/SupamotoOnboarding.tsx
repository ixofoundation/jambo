import { FC, useState } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import OnboardingLanguage from '@components/SupaMotoScreens/OnboardingLanguage';

type SupaMotoOnboardingProps = {
    loading?: boolean;
};

// const progressBarColor = '#E0A714';
const SupaMotoOnboarding: FC<SupaMotoOnboardingProps> = ({ loading = false }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            window.location.href = '/';
        }
    };
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
