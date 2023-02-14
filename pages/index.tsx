import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import CustomSwiper from '@components/Swiper/Swiper';
import config from '@constants/config.json';
import { ACTION } from 'types/actions';
import Head from '@components/Head/Head';

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
