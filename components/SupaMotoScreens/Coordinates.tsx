import React, { FC, useState, useEffect, useRef } from 'react'
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';
import Location from '@icons/location.svg';
import LocationWhite from '@icons/location_white.svg';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Verbal from './Verbal';
import Footer from '@components/Footer/Footer';
import ProfilePicture from './ProfilePicture';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

interface CoordinatesProps {
    lat: string;
    lng: string;
}

const Coordinates: FC<CoordinatesProps> = ({ lat, lng }) => {
    const { currentScreen, switchToScreen } = useRenderScreen('coordinates');
    const [latitude, setLatitude] = useState(lat || '');
    const [longitude, setLongitude] = useState(lng || '');
    const mapProjection = {
        center: [parseFloat(longitude), parseFloat(latitude)],
        scale: 800,
    };

    const renderMap = () => {
        return (
            <div className={styles.mapContainer}>
                <ComposableMap
                    projectionConfig={mapProjection}
                    width={400}
                    height={280}
                >
                    <Geographies geography="/features.json">
                        {({ geographies }) =>
                            geographies.map((geo) => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill="#ECEFF1"
                                    stroke="#607D8B"
                                />
                            ))
                        }
                    </Geographies>
                    <Marker coordinates={[parseFloat(longitude), parseFloat(latitude)]}>
                        <circle r={6} fill="#F00" />
                    </Marker>
                </ComposableMap>
            </div>
        );
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
            case 'render_map':
                return (
                    <div className={styles.onboardingComponent} style={{ overflow: 'none' }} >
                        <IconText title='GPS Coordinates' Img={Location} imgSize={50} />
                        {latitude && longitude && renderMap()}
                        <div className={styles.table} >
                            <p style={{ position: 'relative', top: '-30px' }} >
                                Is this Correct?
                            </p>
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'verbal':
                return <Verbal />
            case 'previous_route':
                return <ProfilePicture />
        }
    }

    const handleCaptureLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const currentLatitude = position.coords.latitude;
                const currentLongitude = position.coords.longitude;
                setLatitude(currentLatitude.toString());
                setLongitude(currentLongitude.toString());
                localStorage.setItem('latitude', currentLatitude.toString());
                localStorage.setItem('longitude', currentLongitude.toString());
                switchToScreen('render_map')
            });
        } else {
            console.error('Geolocation is not supported or permission denied.');
        }
    };

    const switchRoute = () => {
        switchToScreen('verbal');
    };

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default Coordinates
