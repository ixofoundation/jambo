import React, { FC, useEffect, useContext } from 'react'
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Loader from '../Loader/Loader';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import WalletQR from './WalletQR';
import UserWallets from './UserWallets';
import { WALLET_TYPE } from 'types/wallet';
// import { createQueryClient } from '@ixo/impactxclient-sdk';
// import { ChainNetwork } from '@ixo/cosmos-chain-resolver/types/types/chain';
import useQueryClient from '@hooks/useQueryClient';
import { WalletContext } from '@contexts/wallet';
import { utils } from '@ixo/impactxclient-sdk';

type QueryCheckProps = {
    loading?: boolean;
    signedIn?: boolean;
}

const QueryCheck: FC<QueryCheckProps> = ({ loading = false, signedIn = true }) => {
    const { queryClient } = useQueryClient();
    const { wallet } = useContext(WalletContext);
    const pubKey = wallet.user?.pubKey;
    const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;

    useEffect(() => {
        const queryIidDocument = async (did: string) => {
            try {
                // const queryClient = await createQueryClient(CHAIN_RPC[chainNetwork]);
                // const res = await queryClient.ixo.iid.v1beta1.iidDocument({ id: did });
                const res = await queryClient?.ixo.iid.v1beta1.iidDocument({ id: did });
                return res;
            } catch (error) {
                console.error('queryIidDocument::', error);
                return undefined;
            }
        };
        // queryIidDocument(`${did}`)
        queryIidDocument(`${did}`)
            .then((result) => {
                console.log('Result:', result);
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    }, [])

    return (
        <>
            <Header />

            <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
                <div className={utilsStyles.spacer3} />
                {loading ? (
                    <Loader />
                ) : !signedIn ? (
                    <WalletQR />
                ) : (
                    <UserWallets onSelected={function (type: WALLET_TYPE): void {
                        throw new Error('Function not implemented.');
                    }} />
                )}
                <div className={utilsStyles.spacer3} />
            </main>

            <Footer onBackUrl='/' backLabel='Home' />
        </>
    )
}

export default QueryCheck
