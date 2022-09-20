import Image from 'next/image';

import config from '@constants/config.json';
import { pushNewRoute } from '@utils/router';
import styles from './header.module.scss';

type HeaderProps = {
	pageTitle?: string;
	configure?: boolean;
	header?: string;
};

const Header = ({ pageTitle, configure = false, header }: HeaderProps) => {
	const { headerShowLogo, headerShowName, siteName } = config;

	return (
		<nav className={styles.nav}>
			{!header && headerShowLogo && (
				<div className={headerShowName ? styles.logo : styles.logoCentered} onClick={() => (configure ? null : pushNewRoute('/'))}>
					<Image alt="logo" src="/images/logo.png" layout="fill" priority />
				</div>
			)}
			{(header || headerShowName) && (
				<div className={styles.nameContainer} onClick={() => (configure ? null : pushNewRoute('/'))}>
					<h1 className={styles.name}>{header ?? siteName}</h1>
				</div>
			)}
			{pageTitle && <p className={styles.subTitle}>{pageTitle}</p>}
		</nav>
	);
};

export default Header;
