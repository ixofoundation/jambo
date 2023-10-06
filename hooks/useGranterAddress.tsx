import { useContext, useEffect, useState } from 'react';
import { WalletContext } from '@contexts/wallet';
import useQueryClient from '@hooks/useQueryClient';
// import { cosmos } from '@ixo/impactxclient-sdk';
import { QueryAllowancesRequest } from '@ixo/impactxclient-sdk/types/codegen/cosmos/feegrant/v1beta1/query';

const useGranterAddress = () => {
    const { queryClient } = useQueryClient();
    const { wallet } = useContext(WalletContext);
    const userAddress = wallet.user?.address ?? 'defaultAddress';  
    const feegrantRequest: QueryAllowancesRequest = { grantee: userAddress };
    const [granter, setGranter] = useState('');

    useEffect(() => {
        const fetchGranter = async () => {
            const response = await queryClient?.cosmos.feegrant.v1beta1.allowances(feegrantRequest);
            if (response && response.allowances.length > 0) {
                const granterAddress = response.allowances[0].granter;
                setGranter(granterAddress);
            }
        };
        fetchGranter();
    }, [userAddress, queryClient, feegrantRequest]);
    
    return granter;
};

export default useGranterAddress;
