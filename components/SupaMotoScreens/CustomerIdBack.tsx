import React from 'react';
import Customer_Back from '@icons/customerback.svg';
import Customer from '@icons/customer.svg';
import IconText from '@components/IconText/IconText';

const CustomerId = () => {
    return (
        <div>
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
            <div>Is the back side photo ok?</div>
        </div>
    )
}

export default CustomerId;
