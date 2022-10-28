import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import CustomSwiper from '@components/swiper/swiper';
import config from '@constants/config.json';
import { ACTION } from 'types/actions';

const Home: NextPage = () => {
	return (
		<>
			<Head>
				<title>{config.siteName}</title>
				<meta name="description" content={config.siteName + ' dApp'} />
			</Head>

			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter)}>
				<div className={utilsStyles.spacer} />
				<CustomSwiper actions={config.actions as ACTION[]} />
				<div className={utilsStyles.spacer} />
			</main>

			<Footer showAboutButton showAccountButton />
		</>
	);
};

export default Home;
