import { HTMLAttributes, useState, useEffect, useContext } from 'react';
import cls from 'classnames';

import styles from './account.module.scss';
import { getKeplr } from '@utils/kepl';
import { getOpera } from '@utils/opera';
import { WALLET_TYPE } from 'types/wallet';
import Button from '@components/button/button';
import { WalletContext } from '@contexts/wallet';
import Wallets from '@components/wallets/wallets';

type AccountProps = {} & HTMLAttributes<HTMLDivElement>;

const Account = ({ className, ...other }: AccountProps) => {
	const { wallet, updateWallet } = useContext(WalletContext);
	const [loaded, setLoaded] = useState(false);
	const keplrWallet = getKeplr();
	const operaWallet = getOpera();

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

	useEffect(() => {
		setLoaded(true);
	}, []);

	return (
		<div className={styles.account}>
			{wallet.user ? <p>{wallet.user?.name ?? 'Hi'}</p> : wallet.walletType ? <p>Please sign in with {wallet.walletType}</p> : <Wallets onSelected={type => updateWallet({ walletType: type })} />}
			<Wallets onSelected={type => updateWallet({ walletType: type })} />
			{/* {wallet.user?.ledgered ? <p>Ledgered</p> : <Button label="Ledger" onClick={handleLedgerDid} />} */}
		</div>
	);
};

export default Account;
