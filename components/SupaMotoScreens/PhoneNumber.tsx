import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import Phone from '@icons/phone.svg'
import IconText from '@components/IconText/IconText';

const PhoneNumber = () => {
    return (
        <div>
            <IconText title='Phone Number' Img={Phone} imgSize={30} />
            <div>
                <input className={styles.inputs} type='text' />
            </div>
        </div>
    )
}

export default PhoneNumber
