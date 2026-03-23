import { createContext } from 'react';

export type BackgroundSetupStatus = 'idle' | 'running' | 'needs_input' | 'success' | 'error';

export type InputRequest = {
  type: 'pin';
  encryptedMnemonic?: string;
  resolve: (value: string) => void;
  reject: (reason: any) => void;
};

export interface FlowCallbacks {
  onStatusUpdate: (message: string) => void;
  requestPin: (encryptedMnemonic?: string) => Promise<string>;
}

export interface BackgroundSetupContextType {
  status: BackgroundSetupStatus;
  statusMessage: string;
  error: string | null;
  inputRequest: InputRequest | null;
  startSetup: (task: () => Promise<void>) => void;
  retry: () => void;
  dismiss: () => void;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  getFlowCallbacks: () => FlowCallbacks;
  awaitCompletion: () => Promise<void>;
}

export const BackgroundSetupContext = createContext<BackgroundSetupContextType>({
  status: 'idle',
  statusMessage: '',
  error: null,
  inputRequest: null,
  startSetup: () => {},
  retry: () => {},
  dismiss: () => {},
  showDetails: false,
  setShowDetails: () => {},
  getFlowCallbacks: () => ({
    onStatusUpdate: () => {},
    requestPin: () => Promise.reject(new Error('BackgroundSetupProvider not mounted')),
  }),
  awaitCompletion: () => Promise.resolve(),
});
