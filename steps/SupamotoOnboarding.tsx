import { FC } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import OnboardingLanguage from '@components/SupaMotoScreens/OnboardingLanguage';

type SupaMotoOnboardingProps = {
    loading?: boolean;
};

const SupaMotoOnboarding: FC<SupaMotoOnboardingProps> = ({ loading = false }) => {
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
            <Footer
                onForward={undefined}
                onBackUrl='/'
                backLabel='Home' />
        </>
    );
};

export default SupaMotoOnboarding;
