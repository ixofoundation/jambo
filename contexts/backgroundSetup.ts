import { createContext } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

export type BackgroundSetupStatus = 'idle' | 'running' | 'success' | 'error';

export interface BackgroundSetupContextType {
  status: BackgroundSetupStatus;
  statusMessage: string;
  error: string | null;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  awaitCompletion: () => Promise<void>;
  getMatrixClient: () => MatrixClient | null;
}

export const BackgroundSetupContext = createContext<BackgroundSetupContextType>({
  status: 'idle',
  statusMessage: '',
  error: null,
  showDetails: false,
  setShowDetails: () => {},
  awaitCompletion: () => Promise.resolve(),
  getMatrixClient: () => null,
});
