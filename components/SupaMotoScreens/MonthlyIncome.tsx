import React, { useState } from 'react'
import Income from '@icons/income.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import MonthlySavings from './MonthlySavings';
import Status from './Status';
import Footer from '@components/Footer/Footer';

const MonthlyIncome = () => {
    const [amount, setAmount] = useState(0);
    const { currentScreen, switchToScreen } = useRenderScreen('monthly_income');
    const handleAmountChange = (event: { target: { value: React.SetStateAction<number>; }; }) => {
        setAmount(event.target.value);
    };
    const renderScreen = () => {
        switch (currentScreen) {
            case 'monthly_income':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Monthly Income' Img={Income} imgSize={30} />
                        <div className={styles.incomeOutput} >
                            <label className={styles.incomeInput} >{amount}</label>
                        </div>
                        <div className={styles.table} >
                            <input
                                className={styles.monthlyIncome}
                                type="range"
                                id="amount"
                                name="amount"
                                min="0"
                                max="10000"
                                step="1"
                                value={amount}
                                onChange={handleAmountChange}
                            />
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'monthly_savings':
                return <MonthlySavings />;
            case 'previous_route':
                return <Status />
            default:
                return <>Empty</>;
        }
    }

    const switchRoute = () => {
        switchToScreen('monthly_savings');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default MonthlyIncome
