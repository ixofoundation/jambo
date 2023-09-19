import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import VillageSvg from '@icons/village.svg';
import IconText from '@components/IconText/IconText';

const Village = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='Village' Img={VillageSvg} imgSize={70} />
            <div className={styles.table} >
                <input className={styles.inputs} type='text' />
            </div>
        </div>
    )
}

export default Village
