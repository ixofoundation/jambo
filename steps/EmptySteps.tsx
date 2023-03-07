import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import WalletCard from '@components/CardWallet/CardWallet';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import WalletImg from '@icons/wallet.svg';
import { pushNewRoute } from '@utils/router';

type EmptyStepsProps = {
  loading?: boolean;
  signedIn?: boolean;
};

const EmptySteps: FC<EmptyStepsProps> = ({ loading = false, signedIn = true }) => {
  const navigateToAccount = () => pushNewRoute('/account');

  return (
    <>
      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <div className={utilsStyles.spacer3} />
        {loading ? (
          <Loader />
        ) : !signedIn ? (
          <WalletCard name='Connect now' Img={WalletImg} onClick={navigateToAccount} />
        ) : (
          <p>Sorry, there is no steps for this action</p>
        )}
        <div className={utilsStyles.spacer3} />
      </main>

      <Footer onBackUrl='/' backLabel='Home' />
    </>
  );
};

export default EmptySteps;
