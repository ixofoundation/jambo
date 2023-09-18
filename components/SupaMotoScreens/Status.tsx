import React, { useState } from 'react'
import Single from '@icons/single.svg';
import SingleWhite from '@icons/single_white.svg';
import Married from '@icons/married.svg';
import MarriedWhite from '@icons/married_white.svg';
import HouseHoldSvg from '@icons/household.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';

const Status = () => {
    const [status, setStatus] = useState('single');
    const handleStatusChange = (newStatus: React.SetStateAction<string>) => {
        setStatus(newStatus);
    };
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='Status' Img={HouseHoldSvg} imgSize={30} />
            <div className={styles.statusContainer} >
                <button
                    className={styles.statusBtn}
                    style={{ backgroundColor: status === 'married' ? '#E0A714' : '#F0F0F0' }}
                    onClick={() => handleStatusChange('married')}
                >
                    {status === 'married' ? (
                        <MarriedWhite style={{ width: '40px', height: '40px' }} />
                    ) : (
                        <Married style={{ width: '40px', height: '40px' }} />
                    )}
                </button>
                <button
                    className={styles.statusBtn}
                    style={{ backgroundColor: status === 'single' ? '#E0A714' : '#F0F0F0' }}
                    onClick={() => handleStatusChange('single')}
                >
                    {status === 'single' ? (
                        <SingleWhite style={{ width: '40px', height: '40px' }} />
                    ) : (
                        <Single style={{ width: '40px', height: '40px' }} />
                    )}
                </button>
            </div>
        </div>
    )
}

export default Status
