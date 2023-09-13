import React, { useState } from 'react';
import styles from './SupaMotoScreens.module.scss';
import HouseHoldSvg from '@icons/household.svg';
import IconText from '@components/IconText/IconText';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';

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
        <div>
            <IconText title='Household Members' Img={HouseHoldSvg} imgSize={30} />
            <div className={styles.houseHoldContainer} >
                <ButtonRound
                    size={BUTTON_ROUND_SIZE.large}
                    color={BUTTON_ROUND_COLOR.lightGrey}
                    onClick={decrementCount} >-</ButtonRound>
                <div className={styles.houseHoldStats} >{count}</div>
                <ButtonRound
                    size={BUTTON_ROUND_SIZE.large}
                    color={BUTTON_ROUND_COLOR.lightGrey}
                    onClick={incrementCount}>+</ButtonRound>
            </div>
        </div>
    )
}

export default HouseHold
