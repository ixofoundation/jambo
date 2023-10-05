import React, { FC, useContext, useEffect, useState } from 'react'
import cls from 'classnames';
import IconText from '../IconText/IconText';
import Profile from '@icons/profile.svg';
import styles from './Wallets.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import stepPagesStyles from '@styles/stepsPages.module.scss';
import Loader from '@components/Loader/Loader';
import LedgerDID from './LedgerDID';
import WalletQR from './WalletQR';
import useQueryClient from '@hooks/useQueryClient';
import { WalletContext } from '@contexts/wallet';
import { utils } from '@ixo/impactxclient-sdk';
import { useRouter } from 'next/router';

type Props = {
    join?: boolean;
};

const Join: FC<Props> = ({ join = false }) => {
    const { queryClient } = useQueryClient();
    const { wallet, updateWalletType } = useContext(WalletContext);
    const pubKey = wallet.user?.pubKey;
    const userAddress = wallet.user?.address ?? 'defaultAddress';
    const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;
    const [connectionEstablished, setConnectionEstablished] = useState(false);
    const [didLedgered, setDidLedgered] = useState(false);
    const router = useRouter();
    const handleConnectionEstablished = () => {
        setConnectionEstablished(true);
    };
    const handleDIDLedgering = () => {
        setDidLedgered(true);
    };
    const navigateConnect = () => {
        router.push('/connecting');
    };
    useEffect(() => {
        const queryIidDocument = async (did: string) => {
            try {
                const res = await queryClient?.ixo.iid.v1beta1.iidDocument({ id: did });
                return res;
            } catch (error) {
                console.error('queryIidDocument::', error);
                return undefined;
            }
        };
        if (did) {
            queryIidDocument(did)
                .then((result) => {
                    console.log('Result:', result);
                    if (result) {
                        handleDIDLedgering();
                    }
                })
                .catch((error) => {
                    console.error('Error:', error);
                });
        }
        if (join && !didLedgered) {
            navigateConnect();
        }
    }, [did, queryClient, userAddress]);
    let renderComponent;
    switch (true) {
        // case join && didLedgered:
        //     renderComponent = <WalletQR />;
        //     break;
        case !join && !connectionEstablished:
            renderComponent = (
                <>
                    <IconText Img={Profile} title={''} imgSize={100} />
                    <p className={styles.centerTxt}>Connect?</p>
                </>
            );
            break;
        default:
            renderComponent = null;
    }
    return (
        <div
            className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, stepPagesStyles.stepContainer)}
            style={{ top: '-150px', position: 'relative' }}
        >
            {renderComponent}
            <LedgerDID
                onDIDLedgered={handleDIDLedgering}
                onConnectionEstablished={handleConnectionEstablished}
            />
        </div>
    )
}

export default Join
