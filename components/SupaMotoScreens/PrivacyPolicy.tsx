import React from 'react'
import Pen from '@icons/pen.svg';
import ContractSvg from '@icons/contract.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';

const PrivacyPolicy = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='' Img={Pen} imgSize={30} />
            <div>
                <IconText
                    title=''
                    Img={ContractSvg} imgSize={150} />
                <p className={styles.customerIdText} >
                    Now the Customer has to Sign a<br />
                    Privacy Policy waiver.<br />
                    Take a photo of the signed<br />
                    document.
                </p>
            </div>
        </div>
    )
}

export default PrivacyPolicy
