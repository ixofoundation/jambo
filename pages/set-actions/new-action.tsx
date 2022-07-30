import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/actionsPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Puzzle from '@icons/puzzle.svg';
import Star from '@icons/star.svg';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';

const NewAction: NextPage = () => {
	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="Create user action" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<Link href="#">
					<a>
						<ButtonRound label="Select from Templates" size={BUTTON_ROUND_SIZE.large}>
							<Puzzle width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="/set-actions/create-action">
					<a>
						<ButtonRound label="Create a User Action" size={BUTTON_ROUND_SIZE.large}>
							<Star width="50px" height="50px" className={styles.svgNoFill} />
						</ButtonRound>
					</a>
				</Link>
			</main>

			<Footer onBackUrl="/set-actions" />
		</>
	);
};

export default NewAction;
