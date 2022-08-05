import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { ConfigContext } from '@contexts/config';
import CustomSwiper from '@components/swiper/swiper';

const Home: NextPage = () => {
	const { config } = useContext(ConfigContext);

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter)}>
				<CustomSwiper actions={config.actions} />
			</main>

			<Footer showAboutButton showAccountButton />
		</>
	);
};

export default Home;
