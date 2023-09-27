import React, { FC, useEffect, useContext, useState } from 'react'
import styles from './Wallets.module.scss';
import Loader from '../Loader/Loader';
import Header from '../Header/Header';
import WalletQR from './WalletQR';
import UserWallets from './UserWallets';
import Join from './Join';
import useQueryClient from '@hooks/useQueryClient';
import { WalletContext } from '@contexts/wallet';
import { utils } from '@ixo/impactxclient-sdk';

type QueryCheckProps = {
    loading?: boolean;
    signedIn?: boolean;
}

const QueryCheck: FC<QueryCheckProps> = ({ loading = false, signedIn = true }) => {
    const { queryClient } = useQueryClient();
    const { wallet, updateWalletType } = useContext(WalletContext);
    const pubKey = wallet.user?.pubKey;
    const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;

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
                })
                .catch((error) => {
                    console.error('Error:', error);
                });
        }
    }, [did, queryClient])

    const noWalletsDetectedOrConnected = !pubKey;

    return (
        <>
            <Header />
            <main>
                {loading ? (
                    <Loader />
                ) : noWalletsDetectedOrConnected ? (
                    <UserWallets onSelected={updateWalletType} />
                ) : (
                    <Join />
                )}
            </main>
        </>
    );
}

export default QueryCheck
