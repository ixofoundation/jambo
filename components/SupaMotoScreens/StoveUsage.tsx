import React, { useState } from 'react'
import styles from './SupaMotoScreens.module.scss';
import Charcoal from '@icons/charcoal.svg';
import Home from '@icons/home.svg';
import Store from '@icons/store.svg';
import IconText from '@components/IconText/IconText';

const StoveUsage = () => {
    const [usage, setUsage] = useState("");

    const handleHomeClick = () => {
        setUsage("Home");
    };

    const handleCommercialClick = () => {
        setUsage("Commercial");
    };

    return (
        <div>
            <IconText title='Stove Usage' Img={Charcoal} imgSize={30} />
            <div>{usage}</div>
            <div>
                <button className={styles.statusBtn} onClick={handleHomeClick} >
                    <IconText title='' Img={Home} imgSize={30} />
                </button>
                <button className={styles.statusBtn} onClick={handleCommercialClick}>
                    <IconText title='' Img={Store} imgSize={30} />
                </button>
            </div>
        </div>
    )
}

export default StoveUsage;
