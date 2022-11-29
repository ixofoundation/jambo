import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import CustomSwiper from '@components/swiper/swiper';
import config from '@constants/config.json';
import { ACTION } from 'types/actions';
import Head from '@components/head/head';

const Home: NextPage = () => {
	return (
		<>
			<Head title={config.siteName} description={config.siteName + ' dApp'} />

			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter)}>
				<div className={utilsStyles.spacer} />
				<CustomSwiper actions={config.actions as ACTION[]} swiper />
				<div className={utilsStyles.spacer} />

				<Footer showAboutButton showAccountButton />
			</main>
		</>
	);
};

export default Home;
