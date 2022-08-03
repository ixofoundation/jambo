import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import styles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Button from '@components/button/button';
import ConfigureProperty, { PropertyInputTypes } from '@components/configure-variable/configure-variable';
import { getAllCSSVariableNames, getAllVariables, getElementCSSVariables } from '@utils/styles';

const Configure: NextPage = () => {
	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header />

			<main className={styles.main}>
				<h1>Configuration</h1>
				<p>
					Go to{' '}
					<Link href="/">
						<a>Home</a>
					</Link>{' '}
					page
				</p>
				<br />
				<br />
				<Button label="button with radius" />
				<ConfigureProperty propertyName="--button-border-radius" propertyInputType={PropertyInputTypes.NUMBER} />
				<ConfigureProperty propertyName="--accent-color" propertyInputType={PropertyInputTypes.COLOR} />
				<br />
				<Button label="console.log new variables" onClick={getAllVariables} />
			</main>

			<Footer />
		</>
	);
};

export default Configure;
