import React from 'react';
import Camera from '@icons/camera.svg';
import ProfilePic from '@icons/profilepic.svg';
import IconText from '@components/IconText/IconText';

const ProfilePicture = () => {
    return (
        <div>
            <IconText title='' Img={Camera} imgSize={50} />
            <div>
                <IconText title='Profile Picture' Img={ProfilePic} imgSize={150} />
            </div>
        </div>
    )
}

export default ProfilePicture
