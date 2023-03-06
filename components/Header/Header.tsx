import { useRouter } from 'next/router';
import Image from 'next/image';

import styles from './Header.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Anchor from '@components/Anchor/Anchor';
import VerticalDots from '@icons/vertical_dots.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import DappStore from '@icons/dapp_store.svg';
import { pushNewRoute } from '@utils/router';
import config from '@constants/config.json';

type HeaderProps = {
  configure?: boolean;
  header?: string;
  allowBack?: boolean;
};

const Header = ({ configure = false, header, allowBack = false }: HeaderProps) => {
  const { headerShowLogo, headerShowName, siteName } = config;
  const router = useRouter();

  return (
    <nav className={styles.nav}>
      {allowBack ? (
        <ColoredIcon
          icon={ArrowLeft}
          size={20}
          className={styles.settingsIcon}
          onClick={router.back}
          color={ICON_COLOR.primary}
        />
      ) : (
        <Anchor active openInNewTab href='https://my.jambo.earth/'>
          <DappStore height={25} className={styles.dappStoreIcon} />
        </Anchor>
      )}
      <div className={styles.row} onClick={() => (configure ? null : pushNewRoute('/'))}>
        {!header && headerShowLogo && (
          <div className={styles.logo}>
            <Image alt='logo' src='/images/logo.png' layout='fill' priority />
          </div>
        )}
        {(header || headerShowName) && <h1 className={styles.name}>{header ?? siteName}</h1>}
      </div>
      <Anchor active href='/settings'>
        <VerticalDots height={20} className={styles.settingsIcon} />
      </Anchor>
    </nav>
  );
};

export default Header;
