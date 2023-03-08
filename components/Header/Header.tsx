import { useRouter } from 'next/router';
import Image from 'next/image';

import styles from './Header.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Anchor from '@components/Anchor/Anchor';
import VerticalDots from '@icons/vertical_dots.svg';
import DappStore from '@icons/squares_grid.svg';
import { pushNewRoute } from '@utils/router';
import config from '@constants/config.json';
import { FC } from 'react';

type HeaderProps = {
  configure?: boolean;
  header?: string;
};

const Header: FC<HeaderProps> = ({ configure = false, header }) => {
  const { headerShowLogo, headerShowName } = config;
  const router = useRouter();

  return (
    <nav className={styles.nav}>
      <Anchor active openInNewTab href='https://my.jambo.earth/'>
        <ColoredIcon icon={DappStore} color={ICON_COLOR.iconGrey} size={25} className={styles.headerIcon} />
      </Anchor>
      <SiteHeader
        displayLogo={!header && headerShowLogo}
        displayName={!!(header || headerShowName)}
        name={header}
        onClick={() => (configure ? null : pushNewRoute('/'))}
      />
      <Anchor active href='/settings'>
        <ColoredIcon icon={VerticalDots} color={ICON_COLOR.iconGrey} size={25} className={styles.headerIcon} />
      </Anchor>
    </nav>
  );
};

type SiteHeaderProps = {
  displayLogo?: boolean;
  displayName?: boolean;
  name?: string;
  onClick?: () => void;
};

export const SiteHeader: FC<SiteHeaderProps> = ({ displayLogo, displayName, name, onClick }) => {
  const { siteName } = config;

  return (
    <div className={styles.row} onClick={onClick}>
      {displayLogo && (
        <div className={styles.logo}>
          <Image alt='logo' src='/images/logo.png' layout='fill' priority />
        </div>
      )}
      {displayName && <h1 className={styles.name}>{name ?? siteName}</h1>}
    </div>
  );
};

export default Header;
