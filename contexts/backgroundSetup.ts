import { createContext } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

export type BackgroundSetupStatus = 'idle' | 'running' | 'success' | 'error';

export interface BackgroundSetupContextType {
  status: BackgroundSetupStatus;
  statusMessage: string;
  error: string | null;
  /** Detailed, multi-line diagnostics report for the current error (when/where/why).
   *  Surfaced behind a "Show details" toggle in the error modal. */
  errorDetails: string | null;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  /**
   * Resolves when the Data Store is ready. While it is still being set up this
   * opens the "setting up" details overlay; `{ quiet: true }` waits without it.
   */
  awaitCompletion: (opts?: { quiet?: boolean }) => Promise<void>;
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
  errorDetails: null,
  showDetails: false,
  setShowDetails: () => {},
  awaitCompletion: () => Promise.resolve(),
  getMatrixClient: () => null,
  ensureEncryptionReady: () => Promise.resolve(),
});
