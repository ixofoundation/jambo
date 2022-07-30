import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/actionsPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Plus from '@icons/plus.svg';
import { ConfigContext } from '@contexts/config';
import ButtonRound from '@components/button-round/button-round';
import ImageInput from '@components/image-input/image-input';

const Actions: NextPage = () => {
	const {
		config: { actions, siteName },
	} = useContext(ConfigContext);

	const hasActions = actions.length > 0;

	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="User Actions" />

			<main className={cls(utilsStyles.main, { [utilsStyles.columnSpaceEvenlyCentered]: !hasActions })}>
				<div className={styles.listActions}>
					{actions.map(action => (
						<div key={action.name} className={styles.actionCard}>
							<ImageInput placeholder="Tap to upload image" className={styles.actionImage} />
							<h3 className={cls(styles.actionName, styles.actionNameText)}>{action.name}</h3>
							<p className={styles.actionDescription}>{action.description}</p>
						</div>
					))}
					<Link href="/set-actions/new-action">
						<a>
							<ButtonRound label={hasActions ? undefined : `Create user actions for ${siteName}`} className={styles.addButton}>
								<Plus width="22px" height="22px" />
							</ButtonRound>
						</a>
					</Link>
				</div>
			</main>

			<Footer onBackUrl="/" onCorrect={null} />
		</>
	);
};

export default Actions;
