import { HTMLAttributes } from 'react';
import cls from 'classnames';

import styles from './Wallets.module.scss';
import { getKeplr } from '@utils/keplr';
import { getOpera } from '@utils/opera';
import { WALLET_TYPE } from 'types/wallet';
import WalletImg from '@icons/wallet.svg';
import WalletCard from '@components/CardWallet/CardWallet';

type WalletsProps = {
	onSelected: (type: WALLET_TYPE) => void;
} & HTMLAttributes<HTMLDivElement>;

const Wallets = ({ onSelected, className, ...other }: WalletsProps) => {
	const keplrWallet = getKeplr();
	const operaWallet = getOpera();

	return (
		<div className={cls(styles.wallets, className)} {...other}>
			{operaWallet || keplrWallet ? (
				<>
					<div className={styles.flex2} />
					<WalletImg width={58} height={58} />
					<h3>Choose Wallet</h3>
					{/* <WalletCard name="Wallet Connect" img="/images/wallets/wallet-connect.png" onClick={() => onSelected(WALLET_TYPE.walletConnect)} /> */}
					{keplrWallet && (
						<WalletCard
							name="Keplr Wallet"
							img="/images/wallets/keplr.png"
							onClick={() => onSelected(WALLET_TYPE.keplr)}
						/>
					)}
					{operaWallet && (
						<WalletCard
							// name="Opera Wallet"
							imgWidth={171}
							img="/images/wallets/opera.png"
							onClick={() => onSelected(WALLET_TYPE.opera)}
						/>
					)}
					<div className={styles.flex3} />
				</>
			) : (
				<>
					<div className={styles.flex2} />
					<WalletImg width={58} height={58} />
					<h3>No Wallet Detected</h3>
					<p>Please use the dApp on Android with the Opera browser.</p>
					<p>Sorry for the inconvenience, more wallets are being added soon!</p>
					<div className={styles.flex3} />
				</>
			)}
		</div>
	);
};

export default Wallets;
