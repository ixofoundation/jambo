import React, { useState } from 'react'
import styles from './SupaMotoScreens.module.scss';
import Charcoal from '@icons/charcoal.svg';
import Home from '@icons/home.svg';
import HomeWhite from '@icons/home_white.svg';
import Store from '@icons/store.svg';
import StoreWhite from '@icons/store_white.svg';
import IconText from '@components/IconText/IconText';

const StoveUsage = () => {
    const [usage, setUsage] = useState("");
    const [status, setStatus] = useState('single');
    const handleStatusChange = (newStatus: React.SetStateAction<string>) => {
        setStatus(newStatus);
    };
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='Stove Usage' Img={Charcoal} imgSize={30} />
            <div>{usage}</div>
            <div className={styles.statusContainer} >
                <button
                    className={styles.statusBtn}
                    style={{ backgroundColor: status === 'married' ? '#E0A714' : '#F0F0F0' }}
                    onClick={() => handleStatusChange('married')}
                >
                    {status === 'married' ? (
                        <HomeWhite style={{ width: '40px', height: '40px' }} />
                    ) : (
                        <Home style={{ width: '40px', height: '40px' }} />
                    )}
                </button>
                <button
                    className={styles.statusBtn}
                    style={{ backgroundColor: status === 'single' ? '#E0A714' : '#F0F0F0' }}
                    onClick={() => handleStatusChange('single')}
                >
                    {status === 'single' ? (
                        <StoreWhite style={{ width: '40px', height: '40px' }} />
                    ) : (
                        <Store style={{ width: '40px', height: '40px' }} />
                    )}
                </button>
            </div>
        </div>
    )
}

export default StoveUsage;
