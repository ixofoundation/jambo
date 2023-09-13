import React, { useState } from 'react'
import styles from './SupaMotoScreens.module.scss';
import GenderSvg from '@icons/gender.svg';
import Home from '@icons/home.svg';
import Store from '@icons/store.svg';
import IconText from '@components/IconText/IconText';

const Gender = () => {
    return (
        <div>
            <IconText title='Stove Usage' Img={GenderSvg} imgSize={30} />
            <div></div>
            <div>
                <button className={styles.statusBtn} >
                    <IconText title='' Img={Home} imgSize={30} />
                </button>
                <button className={styles.statusBtn}>
                    <IconText title='' Img={Store} imgSize={30} />
                </button>
            </div>
        </div>
    )
}

export default Gender;
