import React from 'react'
import Pen from '@icons/pen.svg';
import ContractSvg from '@icons/contract.svg';
import styles from './SupaMotoScreens.module.scss';
import IconText from '@components/IconText/IconText';

const Contract = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='' Img={Pen} imgSize={30} />
            <div className={styles.table} >
                <div>
                    <IconText
                        title=''
                        Img={ContractSvg} imgSize={150} />
                    <p className={styles.customerIdText} >
                        The Customer has to Sign a<br />
                        Contract. Take a photo of the<br />
                        Signed Contract.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Contract
