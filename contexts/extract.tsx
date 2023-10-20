import React, { createContext, useState, useContext, ReactNode } from 'react';

type ExtractContextType = {
  extract: any;
  setExtract: React.Dispatch<React.SetStateAction<any>>;
  extractProposalId: any;
  setExtractProposalId: React.Dispatch<React.SetStateAction<any>>;
};

const ExtractContext = createContext<ExtractContextType | undefined>(undefined);

type ExtractProviderProps = {
  children: ReactNode;
};

export function ExtractProvider({ children }: ExtractProviderProps) {
  const [extract, setExtract] = useState<any>(null);
  const [extractProposalId, setExtractProposalId] = useState<any>(null);

  return (
    <ExtractContext.Provider value={{ extract, setExtract, extractProposalId, setExtractProposalId }}>
      {children}
    </ExtractContext.Provider>
  );
}

export function useExtractState() {
  const context = useContext(ExtractContext);
  if (context === undefined) {
    throw new Error('useExtractState must be used within an ExtractProvider');
  }
  return context;
}
