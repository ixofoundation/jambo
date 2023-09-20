import React, { FC } from 'react'
import IconText from '../IconText/IconText';
import Profile from '@icons/profile.svg';
import styles from './Wallets.module.scss';
import Loader from '@components/Loader/Loader';
import Footer from '@components/Footer/Footer';

type Props = {
    join?: boolean;
};

const Join: FC<Props> = ({ join = false }) => {
    return (
        <div>
            {join ? (
                <>
                    <Loader />
                    <p className={styles.centerTxt}>Joining...</p>
                </>
            ) : (
                <>
                    <IconText Img={Profile} title={''} imgSize={100} />
                    <p className={styles.centerTxt}>Join?</p>
                </>
            )}
            <Footer
                onBack={() => null}
                onForwardThumb={() => null}
            />
        </div>
    )
}

export default Join
