import { createContext } from 'react';

export type BackgroundSetupStatus = 'idle' | 'running' | 'success' | 'error';

export interface BackgroundSetupContextType {
  status: BackgroundSetupStatus;
  statusMessage: string;
  error: string | null;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  awaitCompletion: () => Promise<void>;
}

export const BackgroundSetupContext = createContext<BackgroundSetupContextType>({
  status: 'idle',
  statusMessage: '',
  error: null,
  showDetails: false,
  setShowDetails: () => {},
  awaitCompletion: () => Promise.resolve(),
});
