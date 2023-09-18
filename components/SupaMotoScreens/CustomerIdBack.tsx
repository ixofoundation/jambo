import React from 'react';
import styles from './SupaMotoScreens.module.scss';
import Customer_Back from '@icons/customerback.svg';
import Customer from '@icons/customer.svg';
import IconText from '@components/IconText/IconText';

const CustomerId = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText
                title=''
                Img={Customer}
                imgSize={30}
            />
            <div>
                <IconText
                    title='Take a photo of the Customer ID back side'
                    Img={Customer_Back}
                    imgSize={150}
                />
            </div>
        </div>
    )
}

export default CustomerId;
