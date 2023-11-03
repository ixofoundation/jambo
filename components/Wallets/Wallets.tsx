import { HTMLAttributes } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './Wallets.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import WalletCard from '@components/CardWallet/CardWallet';
import WalletImg from '@icons/wallet.svg';
import { getWalletConnect } from '@utils/walletConnect';
import { getOpera } from '@utils/opera';
import { getKeplr } from '@utils/keplr';
import { WALLETS } from '@constants/wallet';
import { WALLET_TYPE } from 'types/wallet';

type WalletsProps = {
  onSelected: (type: WALLET_TYPE) => void;
} & HTMLAttributes<HTMLDivElement>;

const Wallets = ({ onSelected, className, ...other }: WalletsProps) => {
  const keplrWallet = getKeplr();
  const operaWallet = getOpera();
  const walletConnect = getWalletConnect();

  return (
    <div className={cls(styles.wallets, className)} {...other}>
      {operaWallet || keplrWallet || walletConnect ? (
        <>
          <div className={utilsStyles.spacer3} />
          <h3>Choose your wallet</h3>
          <div className={utilsStyles.spacer3} />
          {!!keplrWallet && (
            <WalletCard
              name={WALLETS.keplr.name}
              img={WALLETS.keplr.img}
              onClick={() => onSelected(WALLET_TYPE.keplr)}
            />
          )}
          {!!operaWallet && (
            <WalletCard
              name={WALLETS.opera.name}
              img={WALLETS.opera.img}
              onClick={() => onSelected(WALLET_TYPE.opera)}
            />
          )}
          {!!walletConnect && (
            <WalletCard
              name={WALLETS.walletConnect.name}
              img={WALLETS.walletConnect.img}
              onClick={() => onSelected(WALLET_TYPE.walletConnect)}
            />
          )}
          <WalletCard name={WALLETS.signX.name} img={WALLETS.signX.img} onClick={() => onSelected(WALLET_TYPE.signX)} />
        </>
      ) : (
        <>
          <div className={utilsStyles.spacer3} />
          <div className={utilsStyles.rowJustifyCenter}>
            <ColoredIcon icon={WalletImg} size={58} color={ICON_COLOR.lightGrey} />
          </div>
          <div className={utilsStyles.spacer1} />
          <h3>No Wallet Detected</h3>
          <div className={utilsStyles.spacer2} />
          <p>This app works best in an Opera mobile browser on Android</p>
        </>
      )}
    </div>
  );
};

export default Wallets;
