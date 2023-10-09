import React, { useContext, useEffect, useState } from 'react'
import { QueryAllowancesRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/feegrant/v1beta1/query';
import useQueryClient from '@hooks/useQueryClient';
import { WalletContext } from '@contexts/wallet';
import { cosmos } from '@ixo/impactxclient-sdk';

const GranterAddress = async () => {
    const { queryClient } = useQueryClient();
    const { wallet, updateWalletType } = useContext(WalletContext);
    const pubKey = wallet.user?.pubKey;
    const userAddress = wallet.user?.address ?? 'defaultAddress';
    const [granterAddress, setGranterAddress] = useState('');
    // const granterAddress = 'ixo1vafr2dqhgz8frc7gf22njz8y2u0fue4kuetey6';

    useEffect(() => {
        const checkAllowance = async () => {
            const feegrantResquest: QueryAllowancesRequest = {
                grantee: userAddress
            };
            const response = await queryClient?.cosmos.feegrant.v1beta1.allowances(feegrantResquest);
            if (response && response.allowances.length > 0) {
                const granter = response?.allowances[0]?.granter;
                console.log('Granter Address:', granter);
                setGranterAddress(granter);
            }
        }
        checkAllowance();
    })
    return granterAddress;
};

export default GranterAddress
