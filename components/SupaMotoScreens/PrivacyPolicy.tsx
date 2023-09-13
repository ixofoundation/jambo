import React from 'react'
import Pen from '@icons/pen.svg';
import ContractSvg from '@icons/contract.svg';
import IconText from '@components/IconText/IconText';

const PrivacyPolicy = () => {
    return (
        <div>
            <IconText title='' Img={Pen} imgSize={30} />
            <div>
                <IconText
                    title='Now the Customer has to Sign a Privacy Policy waiver. Take a photo of the signed document.'
                    Img={ContractSvg} imgSize={150} />
            </div>
        </div>
    )
}

export default PrivacyPolicy
