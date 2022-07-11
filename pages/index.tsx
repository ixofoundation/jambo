import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import styles from '@styles/Home.module.scss';
import Header from '@components/header';
import Footer from '@components/footer';
import Button from '@components/button/button';
import { pushNewRoute } from '@utils/router';

const Home: NextPage = () => {
	return (
		<div className={styles.container}>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header />

			<main className={styles.main}>
				<h1 className={styles.title}>Welcome to EarthDay!</h1>
				<p>
					Go to{' '}
					<Link href="/saveEarth">
						<a className={styles.link}>SaveEarth</a>
					</Link>{' '}
					page
				</p>
				<p>
					Go to{' '}
					<Link href="/protectEarth">
						<a className={styles.link}>ProtectEarth</a>
					</Link>{' '}
					page
				</p>
				<Button label="configure" onClick={() => pushNewRoute('/configure')} />
			</main>

			<Footer />
		</div>
	);
};

export default Home;
