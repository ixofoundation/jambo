import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import HouseHoldSvg from '@icons/household.svg';
import Married from '@icons/married.svg';
import Single from '@icons/single.svg';
import IconText from '@components/IconText/IconText';

const Status = () => {
    return (
        <div>
            <IconText title='Status' Img={HouseHoldSvg} imgSize={30} />
            <div>
                <button className={styles.statusBtn} >
                    <IconText title='' Img={Married} imgSize={30} />
                </button>
                <button className={styles.statusBtn} >
                    <IconText title='' Img={Single} imgSize={30} />
                </button>
            </div>
        </div>
    )
}

export default Status
