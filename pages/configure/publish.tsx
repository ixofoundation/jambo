import { useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/actionsPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import Star from '@icons/star.svg';
import StarFull from '@icons/star_full.svg';
import { ConfigContext } from '@contexts/config';

const Publish: NextPage = () => {
	const [published, setPublished] = useState(false);

	// const { config } = useContext(ConfigContext);
	// const checkStylesSet = config.setStylesDone;

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle={published ? 'Well done!!' : 'almost done...'} />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<Link href="">
					<a>
						<ButtonRound label={published ? 'Successfully published!' : 'Publish'} size={BUTTON_ROUND_SIZE.large} color={published ? BUTTON_ROUND_COLOR.success : undefined} onClick={() => setPublished(true)}>
							{published ? <StarFull width="50px" height="50px" /> : <Star width="50px" height="50px" className={styles.svgNoFill} />}
						</ButtonRound>
					</a>
				</Link>
			</main>

			<Footer onBackUrl="/configure/set-up" />
		</>
	);
};

export default Publish;
