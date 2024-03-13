import { useContext } from 'react';

import { WalletContext } from '@contexts/wallet';

const useWalletContext = () => {
  const context = useContext(WalletContext);

  if (context === undefined) throw new Error('useWalletContext must be used within the WalletProvider');

  return context;
};

export default useWalletContext;
