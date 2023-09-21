import { HTMLAttributes } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './Wallets.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import WalletCard from '@components/CardWallet/CardWallet';
import WalletImg from '@icons/wallet.svg';
import Footer from '@components/Footer/Footer';
import { getWalletConnect } from '@utils/walletConnect';
import { getOpera } from '@utils/opera';
import { getKeplr } from '@utils/keplr';
import { WALLETS } from '@constants/wallet';
import { WALLET_TYPE } from 'types/wallet';

type WalletsProps = {
    onSelected: (type: WALLET_TYPE) => void;
} & HTMLAttributes<HTMLDivElement>;

const UserWallets = ({ onSelected, className, ...other }: WalletsProps) => {
    const keplrWallet = getKeplr();
    const operaWallet = getOpera();
    const walletConnect = getWalletConnect();

    return (
        <div className={styles.adjustTop} >
            {operaWallet || keplrWallet || walletConnect ? (
                <>
                    <div className={utilsStyles.spacer3} />
                    <h3 className={styles.centerTxt} >Choose your wallet</h3>
                    <div className={utilsStyles.spacer3} />
                    {!!keplrWallet && (
                        <WalletCard
                            style={{ width: '300px' }}
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
                </>
            ) : (
                <>
                    <div className={utilsStyles.spacer3} />
                    <div className={utilsStyles.rowJustifyCenter}>
                        <ColoredIcon icon={WalletImg} size={58} color={ICON_COLOR.lightGrey} />
                    </div>
                    <div className={utilsStyles.spacer1} />
                    <h3 className={styles.centerTxt} >No Wallet Detected</h3>
                    <div className={utilsStyles.spacer2} />
                    <p className={styles.centerTxt} >This app works best in an Opera mobile browser on Android</p>
                </>
            )}
            <Footer onBackUrl='/' backLabel='Home' />
        </div>
    );
};

export default UserWallets;
