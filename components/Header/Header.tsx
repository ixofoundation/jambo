import { useRouter } from 'next/router';
import Image from 'next/image';

import styles from './Header.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Anchor from '@components/Anchor/Anchor';
import VerticalDots from '@icons/vertical_dots.svg';
import DappStore from '@icons/squares_grid.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import { pushNewRoute } from '@utils/router';
import config from '@constants/config.json';

type HeaderProps = {
  configure?: boolean;
  header?: string;
};

const Header = ({ configure = false, header }: HeaderProps) => {
  const { headerShowLogo, headerShowName, siteName } = config;
  const router = useRouter();

  return (
    <nav className={styles.nav}>
      <Anchor active openInNewTab href='https://my.jambo.earth/'>
        <ColoredIcon icon={DappStore} color={ICON_COLOR.iconGrey} size={25} className={styles.headerIcon} />
      </Anchor>
      <div className={styles.row} onClick={() => (configure ? null : pushNewRoute('/'))}>
        {!header && headerShowLogo && (
          <div className={styles.logo}>
            <Image alt='logo' src='/images/logo.png' layout='fill' priority />
          </div>
        )}
        {(header || headerShowName) && <h1 className={styles.name}>{header ?? siteName}</h1>}
      </div>
      <Anchor active href='/settings'>
        <ColoredIcon icon={VerticalDots} color={ICON_COLOR.iconGrey} size={25} className={styles.headerIcon} />
      </Anchor>
    </nav>
  );
};

export default Header;
