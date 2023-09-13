import React from 'react'
import Pen from '@icons/pen.svg';
import ContractSvg from '@icons/contract.svg';
import IconText from '@components/IconText/IconText';

const Contract = () => {
    return (
        <div>
            <IconText title='' Img={Pen} imgSize={30} />
            <div>
                <IconText
                    title='The Customer has to Sign a Contract. Take a photo of the Signed Contract.'
                    Img={ContractSvg} imgSize={150} />
            </div>
        </div>
    )
}

export default Contract
