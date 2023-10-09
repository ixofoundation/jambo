import React, { FC, useContext, useEffect, useState } from 'react'

import { useRouter } from 'next/router';
import { cosmos, utils } from '@ixo/impactxclient-sdk';
import { TRX_MSG } from 'types/transactions';
import { defaultTrxFeeOption, generateCreateIidTrx } from '@utils/transactions';
import { WalletContext } from '@contexts/wallet';
import Footer from '@components/Footer/Footer';
import { ChainNetwork } from 'pages/api/feegrant/grantFeegrantBasic';
import axios from 'axios';
import { broadCastMessages } from '@utils/wallets';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { ChainContext } from '@contexts/chain';
import Join from './Join';
import useQueryClient from '@hooks/useQueryClient';
import { QueryAllowancesByGranterRequest, QueryAllowancesRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/feegrant/v1beta1/query';
import { BasicAllowance } from '@ixo/impactxclient-sdk/types/codegen/cosmos/feegrant/v1beta1/feegrant';

type Props = {
    onConnectionEstablished: () => void;
    onDIDLedgered: () => void;
}

const LedgerDID: FC<Props> = ({ onConnectionEstablished, onDIDLedgered }) => {
    const [successHash, setSuccessHash] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [connectionScreenVisible, setConnectionScreenVisible] = useState(false);
    const [feeGrantSuccess, setFeeGrantSuccess] = useState(false);
    const [ifFeegrantExist, setExistingFeegrant] = useState(true);
    const [runFeegrant, setRunFeegrant] = useState(false);
    const { wallet } = useContext(WalletContext);
    const pubKey = wallet.user?.pubKey ?? new Uint8Array();
    const did = `${pubKey ? utils.did.generateSecpDid(pubKey) : ''}`;
    const userAddress = wallet.user?.address ?? 'defaultAddress';
    const network: ChainNetwork = ChainNetwork.MAINNET;
    const { chainInfo } = useContext(ChainContext);
    const { queryClient } = useQueryClient();
    // const router = useRouter();

    // useEffect(() => {
    //     const grantAllowance = async () => {
    //         const feegrantResquest: QueryAllowancesRequest = {
    //             grantee: userAddress
    //         };
    //         const response = await queryClient?.cosmos.feegrant.v1beta1.allowances(feegrantResquest);
    //         if (response && response.allowances.length > 0) {
    //             console.log('Fee grant already exists:', response.allowances);
    //             // const granter = response.allowances[0]?.granter;
    //             // console.log('Granter Address:', granter);
    //             setExistingFeegrant(false);
    //         } else {
    //             setExistingFeegrant(true);
    //         }
    //     };
    //     grantAllowance();
    // }, [userAddress, network, queryClient]);

    const signTX = async (): Promise<void> => {
        setLoading(true);
        const trxMsg: TRX_MSG[] = [
            generateCreateIidTrx({
                did: did,
                pubkey: pubKey,
                address: userAddress,
                keyType: 'secp',
            }),
        ];
        // const feeGrantResponse = await axios.post('/api/feegrant/grantFeegrantBasic', {
        //     address: userAddress,
        //     chainNetwork: network,
        // });
        // if (feeGrantResponse.status === 200) {
        //     console.log('Fee grant granted successfully.');
        //     console.log('Fee grant response:', feeGrantResponse.data); 
        // } else {
        //     console.error('Fee grant message unsuccessful');
        // }
        try {
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
            setFeeGrantSuccess(true);
            onConnectionEstablished();
        } catch (error) {
            console.error('Error broadcasting transaction:', error);
        }
        setLoading(false);
    };
    return (
        <div>
            {feeGrantSuccess ? (
                <Join join={true} />
            ) : (
                <Footer
                    onBackCancel={() => null}
                    onCorrect={async () => {
                        signTX();
                        // navigateConnect();
                        onConnectionEstablished();
                    }}
                />
            )}
        </div>
    );
}

export default LedgerDID