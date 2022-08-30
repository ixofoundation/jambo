import { useContext, useState, ChangeEvent } from 'react';
import Image from 'next/image';

import { ConfigContext } from '@contexts/config';
import { pushNewRoute } from '@utils/router';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import styles from './header.module.scss';
import Reload from '@icons/reload.svg';
import Pencil from '@icons/pencil.svg';
import Modal from '@components/modal/modal';
import Input from '@components/input/input';

type HeaderProps = {
	pageTitle?: string;
	configure?: boolean;
	header?: string;
};

const Header = ({ pageTitle, configure = false, header }: HeaderProps) => {
	const [showNameModal, setShowNameModal] = useState(false);
	const {
		updateConfig,
		config: { headerShowLogo, headerShowName, siteName },
	} = useContext(ConfigContext);

	const handleReloadButton = () => {
		if (headerShowLogo && headerShowName) return updateConfig({ headerShowName: false });
		else if (headerShowLogo) return updateConfig({ headerShowName: true, headerShowLogo: false });
		else return updateConfig({ headerShowLogo: true });
	};

	const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
		updateConfig({ siteName: e.target.value });
	};

	return (
		<nav className={styles.nav}>
			{!header && headerShowLogo && (
				<div className={headerShowName ? styles.logo : styles.logoCentered} onClick={() => (configure ? null : pushNewRoute('/'))}>
					<Image alt="logo" src="/images/logo.png" layout="fill" priority />
					{configure && (
						<ButtonRound size={BUTTON_ROUND_SIZE.xsmall} color={BUTTON_ROUND_COLOR.grey} className={styles.configureButton}>
							<Pencil width="9px" height="9px" />
						</ButtonRound>
					)}
				</div>
			)}
			{(header || headerShowName) && (
				<div className={styles.nameContainer} onClick={() => (configure ? null : pushNewRoute('/'))}>
					<h1 className={styles.name}>{header ?? siteName}</h1>
					{configure && (
						<ButtonRound size={BUTTON_ROUND_SIZE.xsmall} color={BUTTON_ROUND_COLOR.grey} className={styles.configureButton} onClick={() => setShowNameModal(true)}>
							<Pencil width="9px" height="9px" />
						</ButtonRound>
					)}
				</div>
			)}
			{pageTitle && <p className={styles.subTitle}>{pageTitle}</p>}
			{configure && (
				<ButtonRound size={BUTTON_ROUND_SIZE.small} color={BUTTON_ROUND_COLOR.grey} className={styles.reloadButton} onClick={handleReloadButton}>
					<Reload width="12px" height="12px" />
				</ButtonRound>
			)}
			{showNameModal && (
				<Modal onClose={() => setShowNameModal(false)} title="Update Name">
					<Input value={siteName} onChange={handleNameChange} maxLength={20} className={styles.modalInput} />
				</Modal>
			)}
		</nav>
	);
};

export default Header;
