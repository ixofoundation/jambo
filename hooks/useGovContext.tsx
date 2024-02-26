import { useContext } from 'react';

import { GovContext } from '@contexts/gov';

const useGovContext = () => {
  const context = useContext(GovContext);

  if (context === undefined) throw new Error('useGovContext must be used within the GovProvider');

  return context;
};

export default useGovContext;
