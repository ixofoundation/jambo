import { useContext } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Link from 'next/link';
import ButtonRound, { BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import StartFull from '@icons/star_full.svg';
import Download from '@icons/download.svg';
import { WalletContext } from '@contexts/wallet';
import Wallets from '@components/wallets/wallets';
import Button from '@components/button/button';
import * as Toast from '@components/toast/toast';
import blocksyncApi from '@utils/blocksync';
import { getKeysafe } from '@utils/keysafe';

const Login: NextPage = () => {
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

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Login" />

			<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				{wallet.user ? <p>{wallet.user?.name ?? 'Hi'}</p> : wallet.walletType ? <p>Please sign in with {wallet.walletType}</p> : <Wallets onSelected={type => updateWallet({ walletType: type })} />}
				<Wallets onSelected={type => updateWallet({ walletType: type })} />
				{/* {wallet.user?.ledgered ? <p>Ledgered</p> : <Button label="Ledger" onClick={handleLedgerDid} />} */}
			</main>
			{/* <main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
				<Link href="/login/create-wallet">
					<a>
						<ButtonRound label="Create new wallet" size={BUTTON_ROUND_SIZE.large}>
							<StartFull width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
				<Link href="/login/import-wallet">
					<a>
						<ButtonRound label="Import existing wallet" size={BUTTON_ROUND_SIZE.large}>
							<Download width="50px" height="50px" />
						</ButtonRound>
					</a>
				</Link>
			</main> */}

			<Footer onBackUrl="/" />
		</>
	);
};

export default Login;
