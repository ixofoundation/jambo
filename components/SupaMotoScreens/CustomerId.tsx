import React from 'react'
import Customer from '@icons/customer.svg';
import IconText from '@components/IconText/IconText';

const CustomerId = () => {
    return (
        <div>
            <IconText title='' Img={Customer} imgSize={30} />
            <div>
                <IconText title='Take a photo of the Customer ID front side'
                    Img={Customer} imgSize={150} />
            </div>
            <div>Is the front side photo ok?</div>
        </div>
    )
}

export default CustomerId;
