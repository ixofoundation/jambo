import { HTMLAttributes, useState, useContext } from 'react';

import styles from './account.module.scss';
import { ChainOptions, ChainOptionType } from 'types/wallet';
import { WalletContext } from '@contexts/wallet';
import Wallets from '@components/wallets/wallets';
import Dropdown from '@components/dropdown/dropdown';
import Card from '@components/card/card';
import AddressActionButton from '@components/address-action-button/address-action-button';
import QR from '@icons/qr_code.svg';
import Envelope from '@icons/envelope.svg';
import { ActionMeta } from 'react-select';
import QRCode from 'react-qr-code';

type AccountProps = {} & HTMLAttributes<HTMLDivElement>;

const Account = ({ className, ...other }: AccountProps) => {
	const [showQR, setShowQR] = useState(false);
	const [selectedOption, setSelectedOption] = useState<ChainOptionType>(ChainOptions[0]);
	const { wallet, updateWallet } = useContext(WalletContext);

	const handleLedgerDid = (): void => {
		// if (wallet.user?.didDoc) {
		// 	const payload = wallet.user.didDoc;
		// 	blocksyncApi.utils
		// 		.getSignData(payload, 'did/AddDid', payload.pubKey)
		// 		.then(async (response: any) => {
		// 			if (response.sign_bytes && response.fee) {
		// 				const keysafe = await getKeysafe();
		// 				keysafe.requestSigning(
		// 					response.sign_bytes,
		// 					(error: any, signature: any) => {
		// 						if (!error) {
		// 							blocksyncApi.user.registerUserDid(payload, signature, response.fee, 'sync').then((registerResponse: any) => {
		// 								if ((registerResponse.code || 0) === 0) {
		// 									Toast.successToast('Your credentials have been registered on the ixo blockchain. This will take a few seconds in the background, you can continue using the site.');
		// 								} else {
		// 									Toast.errorToast('Unable to ledger did at this time, please contact our support at support@ixo.world');
		// 								}
		// 							});
		// 						} else {
		// 							Toast.errorToast('Unable to ledger did at this time, please contact our support at support@ixo.world');
		// 						}
		// 					},
		// 					'base64',
		// 				);
		// 			} else {
		// 				Toast.errorToast('Unable to ledger did at this time, please contact our support at support@ixo.world');
		// 			}
		// 		})
		// 		.catch(() => {
		// 			Toast.errorToast('Unable to ledger did at this time, please contact our support at support@ixo.world');
		// 		});
		// } else {
		// 	Toast.errorToast('We cannot find your keysafe information, please reach out to our support at support@ixo.world');
		// }
	};

	const onChainSelected = (option: any, actionMeta: ActionMeta<unknown>) => {
		setSelectedOption(option as ChainOptionType);
	};

	return (
		<div className={styles.account}>
			{wallet.user ? (
				<>
					<p className={styles.name}>{wallet.user.name ?? 'Hi'}</p>
					{showQR ? (
						<div className={styles.qrContainer}>
							<QRCode value={wallet.user.address} size={150} />
							<AddressActionButton address={wallet.user.address} ButtonLogo={Envelope} buttonOnClick={() => setShowQR(true)} />
						</div>
					) : (
						<>
							<AddressActionButton address={wallet.user.address} ButtonLogo={QR} buttonOnClick={() => setShowQR(true)} />
							<p className={styles.label}>Select chain:</p>
							<Dropdown defaultValue={selectedOption} onChange={onChainSelected} options={ChainOptions} placeholder={null} name="chain" withChainLogos={true} />
							<p className={styles.label}>Available:</p>
							<Card>
								<p>Available ...</p>
							</Card>
						</>
					)}
				</>
			) : (
				<Wallets onSelected={type => updateWallet({ walletType: type })} />
			)}
			{/* {wallet.user?.ledgered ? <p>Ledgered</p> : <Button label="Ledger" onClick={handleLedgerDid} />} */}
		</div>
	);
};

export default Account;
