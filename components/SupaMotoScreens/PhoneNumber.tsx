import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import Phone from '@icons/phone.svg'
import IconText from '@components/IconText/IconText';

const PhoneNumber = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='Phone Number' Img={Phone} imgSize={30} />
            <div className={styles.table} >
                <input className={styles.inputs} type='text' />
            </div>
        </div>
    )
}

export default PhoneNumber
