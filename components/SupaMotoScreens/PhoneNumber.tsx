import React, { useState } from 'react';
import styles from './SupaMotoScreens.module.scss';
import Phone from '@icons/phone.svg'
import IconText from '@components/IconText/IconText';
import { useRenderScreen } from '@hooks/useRenderScreen';
import Contract from './Contract';
import Footer from '@components/Footer/Footer';
import SMS from './SMS';

const PhoneNumber = () => {
    const { currentScreen, switchToScreen } = useRenderScreen('phone_number');
    const [phoneNumber, setPhoneNumber] = useState('');

    const handlePhoneNumberChange = (event: { target: { value: any; }; }) => {
        const newPhoneNumber = event.target.value;
        setPhoneNumber(newPhoneNumber);
        localStorage.setItem('phoneNumber', newPhoneNumber);
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'phone_number':
                return (
                    <div className={styles.onboardingComponent} >
                        <IconText title='Phone Number' Img={Phone} imgSize={30} />
                        <div className={styles.table} >
                            <input
                                type='text'
                                className={styles.inputs}
                                value={phoneNumber}
                                onChange={handlePhoneNumberChange}
                            />
                        </div>
                        <Footer onBack={routeBack} onBackUrl='/' onForward={switchRoute} />
                    </div>
                )
            case 'contract':
                return <Contract />
            case 'previous_route':
                return <SMS />
        }
    }

    const switchRoute = () => {
        switchToScreen('contract');
    };

    const routeBack = () => {
        switchToScreen('previous_route');
    };

    return renderScreen()
}

export default PhoneNumber
