import React, { useState } from 'react';
import styles from './SupaMotoScreens.module.scss';
import HouseHoldSvg from '@icons/household.svg';
import Increment from '@icons/increment.svg';
import Decrement from '@icons/decrement.svg';
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Status from './Status';
import Dob from './Dob';
import Footer from '@components/Footer/Footer';

const HouseHold = () => {
    const [count, setCount] = useState(0);
    const { currentScreen, switchToScreen } = useRenderScreen('household');
    const incrementCount = () => {
        setCount(count + 1);
    };
    const decrementCount = () => {
        if (count > 0) {
            setCount(count - 1);
        }
    };
    const renderScreen = () => {
        switch (currentScreen) {
            case 'household':
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
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'status':
                return <Status />;
            case 'previous_route':
                return <Dob />
            default:
                return <>Empty</>;
        }
    }

    const switchRoute = () => {
        switchToScreen('status');
    };
    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default HouseHold
