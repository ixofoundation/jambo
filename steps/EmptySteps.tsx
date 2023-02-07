import { FC, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import WalletImg from '@icons/wallet.svg';
import { WalletContext } from '@contexts/wallet';
import WalletCard from '@components/CardWallet/CardWallet';

type EmptyStepsProps = {
	loading?: boolean;
	signedIn?: boolean;
};

const EmptySteps: FC<EmptyStepsProps> = ({ loading = false, signedIn = true }) => {
	const { showWalletModal } = useContext(WalletContext);

	return (
		<>
			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<div className={utilsStyles.spacer} />
				{loading ? (
					<Loader />
				) : !signedIn ? (
					<WalletCard name="Connect now" Img={WalletImg} onClick={showWalletModal} />
				) : (
					<p>Sorry, there is no steps for this action</p>
				)}
				<div className={utilsStyles.spacer} />

				<Footer onBackUrl="/" backLabel="Home" />
			</main>
		</>
	);
};

export default EmptySteps;
