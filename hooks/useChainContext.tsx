import { useContext } from 'react';

import { ChainContext } from '@contexts/chain';

const useChainContext = () => {
  const context = useContext(ChainContext);

  if (context === undefined) throw new Error('useChainContext must be used within the ChainProvider');

  return context;
};

export default useChainContext;
