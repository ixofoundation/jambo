import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stylesPage.module.scss';
import Correct from '@icons/correct.svg';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { pushNewRoute } from '@utils/router';
import fontConfig from '@constants/fonts.json';
import { ConfigContext } from '@contexts/config';

const SetFont: NextPage = () => {
	const { updateConfig, config } = useContext(ConfigContext);

	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
				<style>{fontConfig.fonts.map(({ fontUrl }) => `@import url(${fontUrl});`)}</style>
			</Head>

			<Header pageTitle="Choose Font" />

			<main className={utilsStyles.main}>
				{fontConfig.fonts.map(({ fontName, fontUrl }) => (
					<div key={fontName} className={styles.fontItem} style={{ fontFamily: fontName }} onClick={() => updateConfig({ fontName, fontUrl })}>
						<div className={fontName == config.fontName ? styles.fontSelected : styles.fontUnselected}>
							<Correct width="18px" height="18px" />
						</div>
						<div>
							<h2>{fontName}</h2>
							<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
						</div>
					</div>
				))}
			</main>

			<Footer onBackUrl="/set-style" onCorrect={() => pushNewRoute('/set-style')} />
		</>
	);
};

export default SetFont;
