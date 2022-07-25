import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stylesPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ButtonRound, { BUTTON_ROUND_COLOR } from '@components/button-round/button-round';
import PaintTray from '@icons/paint_tray.svg';
import Aa from '@icons/Aa.svg';
import Card from '@components/card/card';
import { ConfigContext } from '@contexts/config';

const SetStyle: NextPage = () => {
	const { config } = useContext(ConfigContext);

	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header configure />

			<main className={utilsStyles.main}>
				<div className={styles.colorAndFontButtons}>
					<Link href="/set-style/color">
						<a>
							<ButtonRound color={BUTTON_ROUND_COLOR.accent}>
								<PaintTray width="18px" height="18px" />
							</ButtonRound>
						</a>
					</Link>
					<Link href="/set-style/font">
						<a>
							<ButtonRound color={BUTTON_ROUND_COLOR.grey}>
								<Aa width="18px" height="18px" />
							</ButtonRound>
						</a>
					</Link>
				</div>
				<Card>
					<p>poij</p>
				</Card>
			</main>

			<Footer onBackUrl="/" onCorrect={null} />
		</>
	);
};

export default SetStyle;
