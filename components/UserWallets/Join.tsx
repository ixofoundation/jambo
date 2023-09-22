import React, { FC, useContext, useState } from 'react'
import cls from 'classnames';
import IconText from '../IconText/IconText';
import Profile from '@icons/profile.svg';
import styles from './Wallets.module.scss';
import utilsStyles from '@styles/utils.module.scss';
import stepPagesStyles from '@styles/stepsPages.module.scss';
import Loader from '@components/Loader/Loader';
import Footer from '@components/Footer/Footer';
import { customMessages, ixo, utils } from '@ixo/impactxclient-sdk';
import { KeyTypes } from '@ixo/impactxclient-sdk/types/messages/iid';
import { TRX_MSG } from 'types/transactions';
import { defaultTrxFeeOption } from '@utils/transactions';
import { queryAllowances } from './QueryAllowance';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { ChainContext } from '@contexts/chain';
import { WalletContext } from '@contexts/wallet';
import { broadCastMessages } from '@utils/wallets';

type Props = {
    join?: boolean;
};

const Join: FC<Props> = ({ join = false }) => {
    const [successHash, setSuccessHash] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const { wallet } = useContext(WalletContext);
    const { chainInfo } = useContext(ChainContext);
    const pubKey = wallet.user?.pubKey ?? new Uint8Array();
    const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;
    const generateCreateIidTrx = ({
        did,
        pubkey,
        address,
        keyType = 'secp',
    }: {
        did: string;
        pubkey: Uint8Array;
        address: string;
        keyType?: KeyTypes;
    }) => ({
        typeUrl: '/ixo.iid.v1beta1.MsgCreateIidDocument',
        value: ixo.iid.v1beta1.MsgCreateIidDocument.fromPartial({
            id: did,
            verifications: customMessages.iid.createIidVerificationMethods({
                did,
                pubkey,
                address,
                controller: did,
                type: keyType,
            }),
            signer: address,
            controllers: [did],
        }),
    });
    const signTX = async (): Promise<void> => {
        setLoading(true);
        const trxMsg: TRX_MSG[] = [
            generateCreateIidTrx({
                did: did,
                pubkey: pubKey,
                address: wallet.user!.address,
                keyType: 'secp',
            }),
        ];
        const hash = await broadCastMessages(
            wallet,
            trxMsg,
            undefined,
            defaultTrxFeeOption,
            '',
            chainInfo as KEPLR_CHAIN_INFO_TYPE
        );
        if (hash) {
            setSuccessHash(hash);
            console.log('Transaction hash: ', hash);
        }

        setLoading(false);
    };
    return (
        <div
            className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, stepPagesStyles.stepContainer)}
            style={{ top: '-150px', position: 'relative' }}
        >
            {join ? (
                <>
                    <Loader />
                    <p className={styles.centerTxt}>Connecting...</p>
                </>
            ) : (
                <>
                    <IconText Img={Profile} title={''} imgSize={100} />
                    <p className={styles.centerTxt}>Connect?</p>
                </>
            )}
            <Footer onBackCancel={() => null} onCorrect={signTX} />
        </div>
    )
}

export default Join
