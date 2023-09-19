import React from 'react';
import Camera from '@icons/camera.svg';
import ProfilePic from '@icons/profilepic.svg';
import IconText from '@components/IconText/IconText';
import styles from './SupaMotoScreens.module.scss';

const ProfilePicture = () => {
    return (
        <div className={styles.onboardingComponent} >
            <IconText title='' Img={Camera} imgSize={50} />
            <div className={styles.table} >
                <IconText title='Profile Picture' Img={ProfilePic} imgSize={150} />
            </div>
        </div>
    )
}

export default ProfilePicture
