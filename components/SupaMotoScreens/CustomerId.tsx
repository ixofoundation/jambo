import React from 'react'
import Customer from '@icons/customer.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';

const CustomerId = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='' Img={Customer} imgSize={30} />
            <div>
                <IconText title='Take a photo of the Customer ID front side'
                    Img={Customer} imgSize={150} />
            </div>
        </div>
    )
}

export default CustomerId;
