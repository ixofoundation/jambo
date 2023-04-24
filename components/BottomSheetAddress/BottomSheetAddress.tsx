import { useContext } from 'react';
import QRCode from 'react-qr-code';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './BottomSheetAddress.module.scss';
import AddressActionButton from '@components/AddressActionButton/AddressActionButton';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { CARD_BG_COLOR } from '@components/Card/Card';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';

type BottomSheetAddressProps = {
  show: boolean;
  onClose?: () => void;
};

const BottomSheetAddress = ({ show, onClose = () => undefined }: BottomSheetAddressProps) => {
  const { wallet } = useContext(WalletContext);
  const { chainInfo } = useContext(ChainContext);
  const { width } = useWindowDimensions();

  if (!show) return null;

  return (
    <BottomSheet onClose={onClose} bgColor={CARD_BG_COLOR.background}>
      <div className={utilsStyles.columnAlignCenter}>
        <div className={styles.usernameWrapper}>
          <ImageWithFallback
            fallbackSrc={'/images/chain-logos/fallback.png'}
            src={chainInfo?.chainSymbolImageUrl ?? ''}
            width={32}
            height={32}
            alt='account'
          />
          <h3 className={styles.username}>{wallet.user?.name ?? 'Hi'}</h3>
        </div>
        <div className={utilsStyles.spacer1} />
        <div className={cls(utilsStyles.columnCenter, styles.qrWrapper)}>
          <QRCode value={wallet?.user?.address ?? ''} size={150} />
        </div>
        <div className={utilsStyles.spacer2} />
        <AddressActionButton
          shortAddress={(wallet?.user?.address?.length ?? 0) >= 42 || (width ?? 0) <= 500}
          address={wallet?.user?.address ?? ''}
          copyOrQr='copy'
        />
        <div className={utilsStyles.spacer1} />
      </div>
    </BottomSheet>
  );
};

export default BottomSheetAddress;
