import { HTMLAttributes, useState, useContext, useEffect } from 'react';
import QRCode from 'react-qr-code';

import styles from './Account.module.scss';
import AddressActionButton from '@components/AddressActionButton/AddressActionButton';
import TokenCard from '@components/TokenCard/TokenCard';
import Dropdown from '@components/Dropdown/Dropdown';
import Wallets from '@components/Wallets/Wallets';
import Loader from '@components/Loader/Loader';
import Switch from '@components/Switch/Switch';
import Button from '@components/Button/Button';
import Card from '@components/Card/Card';
import ArrowLeft from '@icons/arrow_left.svg';
import QR from '@icons/qr_code.svg';
import Copy from '@icons/copy.svg';
import { getChainDropdownOption, getChainDropdownOptions, getChainFromChains } from '@utils/chains';
import { CHAIN_DROPDOWN_OPTION_TYPE, CHAIN_NETWORK_TYPE, KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { EnableDeveloperMode } from '@constants/chains';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';

type AccountProps = {} & HTMLAttributes<HTMLDivElement>;

const Account = ({ className, ...other }: AccountProps) => {
	const [showQR, setShowQR] = useState<boolean>(false);
	const { wallet, updateWalletType, fetchAssets, logoutWallet } = useContext(WalletContext);
	const { chain, chains, updateChainId, updateChainNetwork } = useContext(ChainContext);

	useEffect(() => {
		fetchAssets();
	}, []);

	const handleDropdownChange = (newValue: unknown) => updateChainId((newValue as CHAIN_DROPDOWN_OPTION_TYPE).value);

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
							<div className={styles.flex}>
								<AddressActionButton
									address={wallet.user.address}
									ButtonLogo={QR}
									buttonOnClick={() => setShowQR(true)}
								/>
								{EnableDeveloperMode && (
									<>
										<p className={styles.label}>Select environment:</p>
										<Switch
											option1={{
												label: 'Mainnet',
												value: 'mainnet',
											}}
											option2={{
												label: 'Testnet',
												value: 'testnet',
											}}
											selectedOption={chain.chainNetwork}
											onOptionSelect={(value) => updateChainNetwork(value as CHAIN_NETWORK_TYPE)}
										/>
									</>
								)}
								<p className={styles.label}>Select chain:</p>
								{!chains?.length ? (
									<div className="flex">
										<Loader
											size={20}
											className={styles.centerLoader}
											style={{ alignSelf: 'center', justifySelf: 'center' }}
										/>
									</div>
								) : (
									<Dropdown
										value={getChainDropdownOption(
											getChainFromChains(chains, chain.chainId) || ({} as KEPLR_CHAIN_INFO_TYPE),
										)}
										// onChange={updateChainId as (newValue: unknown, actionMeta: ActionMeta<unknown>) => void}
										onChange={handleDropdownChange}
										options={getChainDropdownOptions(chains ?? [])}
										placeholder={null}
										name="chain"
										withLogos={true}
									/>
								)}
								<p className={styles.label}>Available:</p>
								{chain.chainLoading ? (
									<div className="flex">
										<Loader
											size={30}
											className={styles.centerLoader}
											style={{ alignSelf: 'center', justifySelf: 'center' }}
										/>
									</div>
								) : (
									<Card className={styles.available}>
										{wallet.balances?.balances?.length ? (
											wallet.balances.balances.map((token) => <TokenCard token={token} key={token.denom} />)
										) : wallet.balances?.loading ? (
											<Loader size={30} className={styles.loader} />
										) : (
											<p className={styles.noBalances}>No Balances to Show</p>
										)}
									</Card>
								)}
							</div>
							<Button label="logout" onClick={logoutWallet} />
						</>
					)}
				</>
			) : (
				<Wallets onSelected={updateWalletType} />
			)}
		</div>
	);
};

export default Account;
