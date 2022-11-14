import { FC, useContext } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Loader from '@components/loader/loader';
import WalletImg from '@icons/wallet.svg';
import { WalletContext } from '@contexts/wallet';
import WalletCard from '@components/card-wallet/card-wallet';

type EmptyStepsProps = {
	loading?: boolean;
	signedIn?: boolean;
};

const EmptySteps: FC<EmptyStepsProps> = ({ loading = false, signedIn = true }) => {
	const { updateWallet } = useContext(WalletContext);

	return (
		<>
			<Header />

			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
				<div className={utilsStyles.spacer} />
				{loading ? <Loader /> : !signedIn ? <WalletCard name="Connect now" Img={WalletImg} onClick={() => updateWallet({ showWalletModal: true })} /> : <p>Sorry, there is no steps for this action</p>}
				<div className={utilsStyles.spacer} />

				<Footer onBackUrl="/" />
			</main>
		</>
	);
};

export default EmptySteps;
