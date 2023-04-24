import { useContext } from 'react';

import utilsStyles from '@styles/utils.module.scss';
import styles from './BottomSheetLogout.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { CARD_BG_COLOR } from '@components/Card/Card';
import ArrowLeft from '@icons/arrow_left.svg';
import Correct from '@icons/correct.svg';
import { WalletContext } from '@contexts/wallet';
import { WALLETS } from '@constants/wallet';

type BottomSheetLogoutProps = {
  show: boolean;
  onClose?: () => void;
};

const BottomSheetLogout = ({ show, onClose = () => undefined }: BottomSheetLogoutProps) => {
  const { wallet, logoutWallet } = useContext(WalletContext);

  const handleLogout = () => {
    onClose();
    logoutWallet();
  };

  if (!show) return null;

  return (
    <BottomSheet onClose={onClose} bgColor={CARD_BG_COLOR.background}>
      <div className={utilsStyles.columnAlignCenter}>
        <div className={styles.titleWrapper}>
          {!!wallet.walletType && (
            <ImageWithFallback
              src={WALLETS[wallet.walletType].img}
              alt={WALLETS[wallet.walletType].name}
              height={32}
              width={32}
              fallbackSrc='/images/chain-logos/fallback.png'
            />
          )}
          <h3 className={styles.title}>{wallet.user?.name ?? 'Hi'}</h3>
        </div>
        <div className={utilsStyles.spacer1} />
        <p>
          Are you sure you want to logout of your <span className={styles.walletName}>{wallet.walletType}</span> wallet?
        </p>
        <div className={utilsStyles.spacer2} />
      </div>
      <div className={utilsStyles.rowAlignSpaceAround}>
        <ButtonRound color={BUTTON_ROUND_COLOR.lightGrey} size={BUTTON_ROUND_SIZE.large} onClick={onClose}>
          <ColoredIcon icon={ArrowLeft} size={24} color={ICON_COLOR.primary} />
        </ButtonRound>
        <ButtonRound color={BUTTON_ROUND_COLOR.lightGrey} size={BUTTON_ROUND_SIZE.large} onClick={handleLogout}>
          <ColoredIcon icon={Correct} size={24} color={ICON_COLOR.primary} />
        </ButtonRound>
      </div>
    </BottomSheet>
  );
};

export default BottomSheetLogout;
