import type { NextPage } from 'next';
import { useContext } from 'react';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import CustomSwiper from '@components/swiper/swiper';
import config from '@constants/config.json';
import { ACTION } from 'types/actions';
import { WalletContext } from '@contexts/wallet';
import { successToast } from '@components/toast/toast';

const Home: NextPage = () => {
	const { wallet } = useContext(WalletContext);

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter)}>
				<p onClick={() => successToast('test')}>{wallet.user?.pubKey ? wallet.user.name || 'Hello there' : 'loged out'}</p>
				<CustomSwiper actions={config.actions as ACTION[]} />
			</main>

			<Footer showAboutButton showAccountButton />
		</>
	);
};

export default Home;
