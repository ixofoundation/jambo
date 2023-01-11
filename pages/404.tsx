import type { NextPage } from 'next';
import cls from 'classnames';
import LottieLight from 'react-lottie-player/dist/LottiePlayerLight';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/aboutPage.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import animation from '@assets/lotties/404_error.json';
import Head from '@components/Head/Head';

const Page404: NextPage = () => {
	return (
		<>
			<Head title="404 Not Found" description="404 Not Found" />

			<Header pageTitle="Page not found" />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyAlignCenter)}>
				<div className={utilsStyles.spacer} />
				<LottieLight
					play={true}
					loop={true}
					animationData={animation}
					speed={1}
					style={{ height: 200, width: 200 }}
				></LottieLight>
				<p className={styles.notFound}>Error 404</p>
				<p className={styles.notFound}>We can&apos;t find the page you are looking for.</p>
				<div className={utilsStyles.spacer} />

				<Footer onBackUrl="/" />
			</main>
		</>
	);
};

export default Page404;
