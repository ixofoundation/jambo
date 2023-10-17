import { FC, useState } from 'react';
import cls from 'classnames';
import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
// import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
// import SupaStyles from '@components/SupaMotoScreens/SupaMotoScreens.module.scss';
// import GetCameraImage from '@components/SupaMotoScreens/GetCameraImage';
import OnboardingLanguage from '@components/SupaMotoScreens/OnboardingLanguage';

type SupaMotoOnboardingProps = {
    loading?: boolean;
};

// const SupaMotoScreens = [
//     <OnboardingLanguage />,
//     <Names />,
//     <Dob />,
//     <HouseHold />,
//     <Status />,
//     <MonthlyIncome />,
//     <MonthlySavings />,
//     <MonthlyCharcoal />,
//     <MonthlyCharcoalEx />,
//     <StoveUsage />,
//     <CustomerId />,
//     <GetCameraImage onSuccess={function (data: never): void {
//         throw new Error('Function not implemented.');
//     } } />,
//     <CustomerIdBack />,
//     <GetCameraImage onSuccess={function (data: never): void {
//         throw new Error('Function not implemented.');
//     } } />,
//     <Gender />,
//     <Village />,
//     <ProfilePicture />,
//     <Coordinates />,
//     <Verbal />,
//     <SMS />,
//     <PhoneNumber />,
//     <Contract />,
//     <PrivacyPolicy />,
// ]

const progressBarColor = '#E0A714';
const SupaMotoOnboarding: FC<SupaMotoOnboardingProps> = ({ loading = false }) => {
    const [currentStep, setCurrentStep] = useState(0);
    // const handleForward = () => {
    //     if (currentStep < SupaMotoScreens.length - 1) {
    //         setCurrentStep(currentStep + 1);
    //     }
    // };
    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            window.location.href = '/';
        }
    };
    // const renderFooter = () => {
    //     if (currentStep === 2) {
    //         return null;
    //     }
    //     return (
    //         <Footer
    //             onForward={handleForward}
    //             onBack={handleBack}
    //             backLabel='Back'
    //         />
    //     );
    // };
    // const progressPercentage = ((currentStep + 1) / SupaMotoScreens.length) * 100;
    return (
        <>
            <Header />
            <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
                <div className={utilsStyles.spacer3} />
                {/* <div className={SupaStyles.progressBarContainer} >
                    <div className={SupaStyles.progressBar} style={{ width: `${progressPercentage}%`, backgroundColor: progressBarColor }}></div>
                </div> */}
                {loading ? (
                    <Loader />
                ) : (
                    <div className={styles.stepContainer} >
                        {/* {SupaMotoScreens[currentStep]} */}
                        <OnboardingLanguage />
                    </div>
                )}
                <div className={utilsStyles.spacer3} />
            </main>
            {/* <Footer
                onForward={handleForward}
                onBack={handleBack}
                backLabel='Back'
            /> */}
            {/* {renderFooter()} */}
        </>
    );
};

export default SupaMotoOnboarding;