import { useContext } from 'react';
import { ChainContext } from '@contexts/chain';

const useQueryClient = () => {
    const { queryClient } = useContext(ChainContext);
    return { queryClient };
};

export default useQueryClient;
