import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import Location from '@icons/location.svg';
import LocationWhite from '@icons/location_white.svg';

const Coordinates = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='GPS Coordinates' Img={Location} imgSize={50} />
            <form className={styles.table} >
                <div>
                    <div>
                        <label
                            className={styles.label}
                        >Latitude</label><br />
                        <input className={styles.inputs} type='text' placeholder='' />
                    </div><br />
                    <div>
                        <label
                            className={styles.label}
                        >Longitude</label><br />
                        <input className={styles.inputs} type='text' placeholder='' />
                    </div>
                    <div className={styles.spaceAround}>
                        <div className={styles.table}>
                            <button className={styles.captureBtn} >
                                <span><LocationWhite style={{ width: '24px', height: '24px' }} /></span>
                                Capture
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default Coordinates
