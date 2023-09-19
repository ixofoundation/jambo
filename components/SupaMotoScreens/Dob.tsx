import React, { useState } from 'react'
import Calendar from '@icons/calendar.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import DayInput from '../DayInput/DayInput';

const Months: JSX.Element[] = Array.from({ length: 12 }, (_, index) => (
    <input
        className={styles.months}
        key={index}
        type='text'
        placeholder={new Date(0, index).toLocaleString('default', { month: 'long' })}
    />
));
const Dob = () => {
    const [days, setDays] = useState(false);
    const [months, setMonths] = useState(false);
    const handleDays = () => {
        setDays(!days);
        setMonths(false);
    };    
    const handleMonths = () => {
        setMonths(!months);
        setDays(false);
    };
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
                    <div className={styles.dobInput}>year</div>
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
                                        <div key={index}>
                                            <div>
                                                {month}
                                            </div>
                                        </div>
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
        </div >
    )
}

export default Dob
