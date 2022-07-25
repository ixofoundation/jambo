import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import Eye from '@icons/eye.svg';
import ManRunning from '@icons/man_running.svg';
import Document from '@icons/document.svg';

const Home: NextPage = () => {
	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Create a new dApp" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<Link href="/set-style">
					<a>
						<ButtonRound label="Set Style" size={BUTTON_ROUND_SIZE.large} successMark={true}>
							<Eye width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="/action">
					<a>
						<ButtonRound label="Set user actions" size={BUTTON_ROUND_SIZE.large}>
							<ManRunning width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<ButtonRound label="Set Description" size={BUTTON_ROUND_SIZE.large}>
					<Document width="50px" height="50px" />
				</ButtonRound>
			</main>

			<Footer onForward={null} />
		</>
	);
};

export default Home;
