import React from 'react'
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import Location from '@icons/location.svg';

const Coordinates = () => {
    return (
        <div>
            <IconText title='GPS Coordinates' Img={Location} imgSize={50} />
            <form>
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
                <button className={styles.captureBtn} >
                    <span><IconText title='' Img={Location} imgSize={20} /></span>
                    Capture
                </button>
            </form>
        </div>
    )
}

export default Coordinates
