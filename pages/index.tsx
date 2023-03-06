import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import CustomSwiper from '@components/Swiper/Swiper';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Head from '@components/Head/Head';
import config from '@constants/config.json';
import { ACTION } from 'types/actions';

const Home: NextPage = () => {
  return (
    <>
      <Head title={config.siteName} description={config.siteName + ' dApp'} />

      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter)}>
        <CustomSwiper actions={config.actions as ACTION[]} swiper />
      </main>

      <Footer showActionsButton showAccountButton />
    </>
  );
};

export default Home;
