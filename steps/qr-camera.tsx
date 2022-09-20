import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Footer from '@components/footer/footer';
import QRScanner from '@components/qr-scanner/qr-scanner';
import useWindowDimensions from '@hooks/window-dimensions';

type QRCameraProps = {
	onSuccess: (text: string) => void;
	onBack?: () => void;
};

const QRCamera: FC<QRCameraProps> = ({ onSuccess, onBack }) => {
	const { height, width, footerHeight } = useWindowDimensions();

	return (
		<>
			<main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer, styles.qrCameraMain)}>
				{width != null && height != null ? (
					<QRScanner qrCodeSuccessCallback={onSuccess} qrCodeErrorCallback={e => {}} qrbox={220} width={width + 'px'} height={height - footerHeight + 'px'} aspectRatio={width / (height - footerHeight)} />
				) : (
					<p>loading...</p>
				)}
			</main>

			<Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} />
		</>
	);
};

export default QRCamera;
