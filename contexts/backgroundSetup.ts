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
  /**
   * Ensure matrix E2EE / cross-signing / key backup is fully set up. If something is
   * missing, fetches the user's encrypted matrix mnemonic, shows the PIN modal, and
   * repairs encryption — resolves when ready, rejects on cancel or failure.
   *
   * Called explicitly when an action requires encryption guarantees (e.g. saving a
   * credential to the user's matrix data store). Reattach on app load does NOT call
   * this automatically.
   */
  ensureEncryptionReady: () => Promise<void>;
}

export const BackgroundSetupContext = createContext<BackgroundSetupContextType>({
  status: 'idle',
  statusMessage: '',
  error: null,
  showDetails: false,
  setShowDetails: () => {},
  awaitCompletion: () => Promise.resolve(),
  getMatrixClient: () => null,
  ensureEncryptionReady: () => Promise.resolve(),
});
