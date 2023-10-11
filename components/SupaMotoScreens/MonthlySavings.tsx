import React, { useState } from 'react'
import Savings from '@icons/savings.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import MonthlyCharcoal from './MonthlyCharcoal';
import MonthlyIncome from './MonthlyIncome';
import Footer from '@components/Footer/Footer';

const MonthlySavings = () => {
    const [amount, setAmount] = useState(0);
    const { currentScreen, switchToScreen } = useRenderScreen('monthly_savings');
    const handleAmountChange = (event: { target: { value: React.SetStateAction<number>; }; }) => {
        setAmount(event.target.value);
    };
    const renderScreen = () => {
        switch (currentScreen) {
            case 'monthly_savings':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Monthly Savings' Img={Savings} imgSize={30} />
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
            case 'monthly_charcoal':
                return <MonthlyCharcoal />;
            case 'previous_route':
                return <MonthlyIncome />
            default:
                return <>Empty</>;
        }
    }

    const switchRoute = () => {
        switchToScreen('monthly_charcoal');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default MonthlySavings;
