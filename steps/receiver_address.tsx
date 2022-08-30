import { ChangeEvent, FC, FormEvent, lazy, Suspense, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import QRScan from '@icons/qr_scan.svg';
import Paste from '@icons/paste.svg';
import InputWithSufficIcon from '@components/input-with-suffix-icon/input-with-suffix-icon';
import { StepDataType, STEPS } from 'types/steps';
import EmptySteps from './empty';

const QRCamera = lazy(() => import('./qr-camera'));

type ReceiverAddressProps = {
	onSuccess: (data: StepDataType<STEPS.get_receiver_address>) => void;
	onBack?: () => void;
	data?: StepDataType<STEPS.get_receiver_address>;
	header?: string;
};

const ReceiverAddress: FC<ReceiverAddressProps> = ({ onSuccess, onBack, data, header }) => {
	const [showQRCamera, setShowQRCamera] = useState(false);
	const [address, setAddress] = useState(data?.address ?? '');

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAddress(event.target.value);
	};

	const formIsValid = () => address.length > 8;

	const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
		event?.preventDefault();
		if (!formIsValid()) return alert('Address must be longer than 8 characters');
		onSuccess({ address });
	};

	return (
		<>
			{showQRCamera ? (
				<Suspense fallback={<EmptySteps loading={true} />}>
					<QRCamera onSuccess={address => onSuccess({ address })} onBack={() => setShowQRCamera(false)} />
				</Suspense>
			) : (
				<>
					<Header pageTitle="Who is the receiver" header={header} />

					<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
						<div onClick={() => setShowQRCamera(true)}>
							<QRScan width="100px" height="100px" className={styles.qrScan} />
							<p>Scan address</p>
						</div>
						<p>or</p>
						<form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete="none">
							<p>Paste address here</p>
							<InputWithSufficIcon name="address" required onChange={handleChange} value={address} Icon={Paste} />
						</form>
					</main>

					<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} onCorrect={formIsValid() ? () => handleSubmit(null) : null} />
				</>
			)}
		</>
	);
};

export default ReceiverAddress;
