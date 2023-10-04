import React, { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';

import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import { pushNewRoute } from '@utils/router';

type Props = {
  loading?: boolean;
  signedIn?: boolean;
};

const Connecting: FC<Props> = ({ loading = false, signedIn = true }) => {
  // const navigateToAccount = () => pushNewRoute('/account');

  return (
    <>
      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        <Loader />
        <p style={{ color: '#FFFFFF' }} >Connecting...</p>
        <div className={utilsStyles.spacer3} />
      </main>

      {/* <Footer onBackUrl='/' backLabel='Home' /> */}
    </>
  );
};

export default Connecting;
