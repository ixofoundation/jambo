import Image from 'next/image';
import { useContext } from 'react';

import { ConfigContext } from '@contexts/config';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/button-round/button-round';
import styles from './header.module.scss';
import Reload from '@icons/reload.svg';
import Pencil from '@icons/pencil.svg';

type HeaderProps = {
	pageTitle?: string;
	configure?: boolean;
};

const Header = ({ pageTitle, configure = false }: HeaderProps) => {
	const { config } = useContext(ConfigContext);

	return (
		<nav className={styles.nav}>
			<div className={styles.logo}>
				<Image alt="logo" src="/images/logo.png" width="37px" height="37px" className={styles.logo} />
				{configure && (
					<ButtonRound size={BUTTON_ROUND_SIZE.xsmall} color={BUTTON_ROUND_COLOR.grey} className={styles.configureButton}>
						<Pencil width="9px" height="9px" />
					</ButtonRound>
				)}
			</div>
			<div className={styles.nameContainer}>
				<p className={styles.name}>{config.siteName}</p>
				{configure && (
					<ButtonRound size={BUTTON_ROUND_SIZE.xsmall} color={BUTTON_ROUND_COLOR.grey} className={styles.configureButton}>
						<Pencil width="9px" height="9px" />
					</ButtonRound>
				)}
			</div>
			{pageTitle && <p className={styles.subTitle}>{pageTitle}</p>}
			{configure && (
				<ButtonRound size={BUTTON_ROUND_SIZE.small} color={BUTTON_ROUND_COLOR.grey} className={styles.reloadButton}>
					<Reload width="12px" height="12px" />
				</ButtonRound>
			)}
		</nav>
	);
};

export default Header;
