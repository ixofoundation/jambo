import React, { useState } from 'react'
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import Location from '@icons/location.svg';
import LocationWhite from '@icons/location_white.svg';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Verbal from './Verbal';
import Footer from '@components/Footer/Footer';
import ProfilePicture from './ProfilePicture';

const Coordinates = () => {
    const { currentScreen, switchToScreen } = useRenderScreen('coordinates');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
                                            
    const handleCaptureLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const currentLatitude = position.coords.latitude;
                const currentLongitude = position.coords.longitude;
                setLatitude(currentLatitude.toString());
                setLongitude(currentLongitude.toString());
                localStorage.setItem('latitude', currentLatitude.toString());
                localStorage.setItem('longitude', currentLongitude.toString());
            });
        } else {
            console.error('Geolocation is not supported or permission denied.');
        }
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'coordinates':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='GPS Coordinates' Img={Location} imgSize={50} />
                        <form className={styles.table} >
                            <div>
                                <div>
                                    <label
                                        className={styles.label}
                                    >Latitude</label><br />
                                    <input
                                        className={styles.inputs}
                                        type='text'
                                        placeholder=''
                                        value={latitude}
                                        readOnly />
                                </div><br />
                                <div>
                                    <label
                                        className={styles.label}
                                    >Longitude</label><br />
                                    <input
                                        className={styles.inputs}
                                        type='text'
                                        placeholder=''
                                        value={longitude}
                                        readOnly />
                                </div>
                                <div className={styles.spaceAround}>
                                    <div className={styles.table}>
                                        <div
                                            className={styles.captureBtn}
                                            onClick={handleCaptureLocation} >
                                            <span><LocationWhite style={{ width: '24px', height: '24px' }} /></span>
                                            Capture
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'verbal':
                return <Verbal />
            case 'previous_route':
                return <ProfilePicture />
        }
    }

    const switchRoute = () => {
        switchToScreen('verbal');
    };

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default Coordinates
