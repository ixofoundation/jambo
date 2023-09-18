import React, { useState } from 'react';
import styles from './SupaMotoScreens.module.scss';
import HouseHoldSvg from '@icons/household.svg';
import Increment from '@icons/increment.svg';
import Decrement from '@icons/decrement.svg';
import IconText from '@components/IconText/IconText';

const HouseHold = () => {
    const [count, setCount] = useState(0);
    const incrementCount = () => {
        setCount(count + 1);
    };
    const decrementCount = () => {
        if (count > 0) {
            setCount(count - 1);
        }
    };
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='Household Members' Img={HouseHoldSvg} imgSize={30} />
            <div className={styles.houseHoldContainer} >
                <button className={styles.houseHoldButtons} onClick={decrementCount} >
                    <Decrement style={{ width: '30px', height: '30px' }} />
                </button>
                <div className={styles.houseHoldStats} >{count}</div>
                <button className={styles.houseHoldButtons} onClick={incrementCount}>
                    <Increment style={{ width: '30px', height: '30px' }} />
                </button>
            </div>
        </div>
    )
}

export default HouseHold
