import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import CustomSwiper from '@components/Swiper/Swiper';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Head from '@components/Head/Head';
import config from '@constants/config.json';
import { ACTION } from 'types/actions';
import BidTester from '@components/BidTester/BidTester';

const Home: NextPage = () => {
  return (
    <>
      <Head title={config.siteName} description={config.siteName + ' dApp'} />

      <Header />

      <main className={cls(utilsStyles.main)}>
        {/* <CustomSwiper actions={config.actions as ACTION[]} swiper /> */}
        <BidTester
          homeServerUrl='http://localhost:8008'
          botUrl='http://localhost:8083'
          accessToken='syt_ZGlkLWl4by1peG8xMjM0NTY3ODkw_IiJWPrZLihpfQiXFmXrn_4Gh129'
          adminAccessToken='syt_YWRtaW4_kiultvQOgtDLWiRoWmaL_0x79Ip'
        />
      </main>
    </>
  );
};

export default Home;
