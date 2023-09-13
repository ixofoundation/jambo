import React, { useState } from 'react'
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import Calendar from '@icons/calendar.svg';

const Dob = () => {
    const [toggleBox, setToggleBox] = useState(true);
    // const Days = Array.from({ length: 31 }, (_, index) => index + 1);
    const Days: number[] = Array.from({ length: 31 }, (_, index) => index + 1);
    return (
        <div>
            <form>
                <IconText title='Birth Date' Img={Calendar} imgSize={30} />
                <div>
                    <input className={styles.dobInput} type='text' placeholder='day' />
                    <input className={styles.dobInput} type='text' placeholder='month' />
                    <input className={styles.dobInput} type='text' placeholder='year' />
                </div>
            </form>
            {
                toggleBox ? (
                    <div>
                        <div className={styles.toggleBox} >
                            {Days.map((day) => (
                                <div key={day} >
                                    <div className={styles.dayz} >
                                        {day}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div>
                        Not Rendering
                    </div>
                )
            }

        </div >
    )
}

export default Dob
