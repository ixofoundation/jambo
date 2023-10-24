import React, { useState } from 'react'
import Calendar from '@icons/calendar.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import DayInput from '../DayInput/DayInput';
import MonthInput from '../MonthInput/MonthInput';
import { useRenderScreen } from '@hooks/useRenderScreen';
import HouseHold from './HouseHold';
import Footer from '@components/Footer/Footer';
import Names from './Names';

const Months: string[] = Array.from({ length: 12 }, (_, index) => (
    new Date(0, index).toLocaleString('default', { month: 'long' })
));



const Dob = () => {
    const [days, setDays] = useState(false);
    const [months, setMonths] = useState(false);
    const { currentScreen, switchToScreen } = useRenderScreen('date_of_birth');
    const [selectedDay, setSelectedDay] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState('');

    const handleDays = () => {
        setDays(!days);
        setMonths(false);
    };

    const handleMonths = () => {
        setMonths(!months);
        setDays(false);
    };

    const saveSelectedValuesToLocal = () => {
        localStorage.setItem('selectedDay', selectedDay);
        localStorage.setItem('selectedYear', selectedYear);
        localStorage.setItem('selectedMonth', selectedMonth || '');
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'date_of_birth':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Birth Date' Img={Calendar} imgSize={50} />
                        <form>
                            <div className={styles.dobForm} >
                                <div
                                    onClick={handleDays}
                                    className={styles.dobInput}
                                >day</div>
                                <div
                                    onClick={handleMonths}
                                    className={styles.dobInput}
                                >month</div>
                                <input
                                    className={styles['custom-input']}
                                    type='text' placeholder='year'
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                />
                            </div>
                            <div className={styles.toggleBoxContainer}>
                                {
                                    days ? (
                                        <div>
                                            <div className={styles.toggleBox} >
                                                {Array.from({ length: 31 }, (_, index) => (
                                                    <DayInput
                                                        key={index}
                                                        day={index + 1}
                                                        selected={selectedDay === (index + 1).toString()}
                                                        onClick={() => setSelectedDay((index + 1).toString())}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                        </div>
                                    )
                                }
                            </div>
                            <div className={styles.toggleBoxContainer}>
                                {
                                    months ? (
                                        <div>
                                            <div className={styles.toggleBoxMonths} >
                                                {Months.map((month, index) => (
                                                    <MonthInput
                                                        key={index}
                                                        month={month}
                                                        selected={selectedMonth === month}
                                                        onClick={() => setSelectedMonth(month)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                        </div>
                                    )
                                }
                            </div>
                        </form>
                        {(!days && !months) && <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />}
                    </div >
                )

            case 'household':
                return <HouseHold />;
            case 'previous_route':
                return <Names />
            default:
                return <>Empty</>;
        }
    }

    const switchRoute = () => {
        saveSelectedValuesToLocal();
        switchToScreen('household');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default Dob
