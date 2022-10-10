import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Loader from '@components/loader/loader';

type EmptyStepsProps = {
	loading?: boolean;
};

const EmptySteps: FC<EmptyStepsProps> = ({ loading }) => {
	return (
		<>
			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>{loading ? <Loader /> : <p>Sorry this url doesn't exist</p>}</main>

			<Footer onBackUrl="/" />
		</>
	);
};

export default EmptySteps;
