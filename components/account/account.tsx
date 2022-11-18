import { HTMLAttributes, useState, useContext, useEffect } from 'react';

import styles from './account.module.scss';
import { WalletContext } from '@contexts/wallet';
import Wallets from '@components/wallets/wallets';
import Dropdown from '@components/dropdown/dropdown';
import Card from '@components/card/card';
import AddressActionButton from '@components/address-action-button/address-action-button';
import QR from '@icons/qr_code.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import Copy from '@icons/copy.svg';
import QRCode from 'react-qr-code';
import TokenCard from '@components/token-card/token-card';
import { ChainDropdownOptions } from '@constants/chains';
import { ArrayElement } from 'types/general';
import Loader from '@components/loader/loader';

type AccountProps = {} & HTMLAttributes<HTMLDivElement>;

const Account = ({ className, ...other }: AccountProps) => {
	const [showQR, setShowQR] = useState(false);
	const [selectedOption, setSelectedOption] = useState<ArrayElement<typeof ChainDropdownOptions>>(
		ChainDropdownOptions[0],
	);
	const { wallet, updateWallet, fetchAssets } = useContext(WalletContext);

	const onChainSelected = (option: any) => setSelectedOption(option);

	useEffect(() => {
		fetchAssets();
	}, []);

	return (
		<div className={styles.account}>
			{showQR ? <ArrowLeft width={20} height={20} color="black" onClick={() => setShowQR(false)} /> : <div />}
			{wallet.user ? (
				<>
					<p className={styles.name}>{wallet.user.name ?? 'Hi'}</p>
					{showQR ? (
						<div className={styles.qrContainer}>
							<QRCode value={wallet.user.address} size={150} />
							<AddressActionButton address={wallet.user.address} ButtonLogo={Copy} wrapButtonWithCopy={true} />
						</div>
					) : (
						<>
							<AddressActionButton
								address={wallet.user.address}
								ButtonLogo={QR}
								buttonOnClick={() => setShowQR(true)}
							/>
							<p className={styles.label}>Select chain:</p>
							<Dropdown
								defaultValue={selectedOption}
								onChange={onChainSelected}
								options={ChainDropdownOptions}
								placeholder={null}
								name="chain"
								withLogos={true}
							/>
							<p className={styles.label}>Available:</p>
							<Card className={styles.available}>
								{wallet.balances?.balances?.length ? (
									wallet.balances.balances.map((token) => <TokenCard token={token} key={token.denom} />)
								) : wallet.balances?.loading ? (
									<Loader size={30} className={styles.loader} />
								) : (
									<p className={styles.noBalances}>No Balances to Show</p>
								)}
							</Card>
						</>
					)}
				</>
			) : (
				<Wallets onSelected={(type) => updateWallet({ walletType: type })} />
			)}
		</div>
	);
};

export default Account;
