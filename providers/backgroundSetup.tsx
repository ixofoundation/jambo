import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { BackgroundSetupContext, BackgroundSetupStatus, InputRequest } from '@contexts/backgroundSetup';
import BackgroundSetupModal from '@components/BackgroundSetupModal/BackgroundSetupModal';
import { secureLoad } from '@utils/storage';
import cons from '@constants/matrix';
import { store, RootState } from '@store/index';
import { registerBackground, matrixLoginBackground } from 'lib/auth/passkeyFlow';

interface BackgroundSetupProviderProps {
  children: ReactNode;
}

export const BackgroundSetupProvider: FC<BackgroundSetupProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<BackgroundSetupStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputRequest, setInputRequest] = useState<InputRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const taskRef = useRef<(() => Promise<void>) | null>(null);
  const statusRef = useRef<BackgroundSetupStatus>('idle');
  const awaitersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    statusRef.current = status;
    if (status === 'success') {
      const pending = awaitersRef.current.splice(0);
      pending.forEach((resolve) => resolve());
    }
  }, [status]);

  const awaitCompletion = useCallback((): Promise<void> => {
    const current = statusRef.current;
    if (current === 'success' || current === 'idle') {
      return Promise.resolve();
    }
    setShowDetails(true);
    return new Promise<void>((resolve) => {
      awaitersRef.current.push(resolve);
    });
  }, []);

  const runTask = useCallback(async (task: () => Promise<void>) => {
    setStatus('running');
    setError(null);
    setStatusMessage('Setting up your Data Vault...');
    try {
      await task();
      setStatus('success');
      setStatusMessage('Data Vault setup complete');
      setInputRequest(null);
    } catch (err: any) {
      console.error('Background setup error:', err);
      setStatus('error');
      setError(err.message || 'Setup failed');
      setInputRequest(null);
    }
  }, []);

  const startSetup = useCallback(
    (task: () => Promise<void>) => {
      taskRef.current = task;
      void runTask(task);
    },
    [runTask],
  );

  const retry = useCallback(() => {
    if (taskRef.current) {
      void runTask(taskRef.current);
    }
  }, [runTask]);

  const dismiss = useCallback(() => {
    if (status === 'success') {
      setStatus('idle');
      setStatusMessage('');
      setError(null);
    }
    setShowDetails(false);
  }, [status]);

  const requestPin = useCallback((encryptedMnemonic?: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      setInputRequest({
        type: 'pin',
        encryptedMnemonic,
        resolve: (value: string) => {
          setInputRequest(null);
          setShowDetails(false);
          setStatus('running');
          setStatusMessage('Completing Data Vault setup...');
          resolve(value);
        },
        reject: (reason: any) => {
          setInputRequest(null);
          reject(reason);
        },
      });
      setStatus('needs_input');
    });
  }, []);

  // Resume backed-up background setup on mount (e.g. after page refresh)
  const resumeAttemptedRef = useRef(false);
  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;

    const bgType = secureLoad(cons.secretKey.BACKGROUND_TYPE);
    if (!bgType) return;

    const account = (store.getState() as RootState).account;
    if (!account?.address || !account?.did) return;

    if (bgType === 'register') {
      const mnemonic = secureLoad(cons.secretKey.MNEMONIC_BACKUP);
      if (!mnemonic) return;
      void runTask(() =>
        registerBackground({
          address: account.address!,
          did: account.did!,
          mxMnemonicOverride: mnemonic,
          callbacks: { onStatusUpdate: setStatusMessage, requestPin },
        }),
      );
    } else if (bgType === 'login') {
      const encMnemonic = secureLoad(cons.secretKey.ENCRYPTED_MNEMONIC_BACKUP);
      if (!encMnemonic) return;
      void runTask(() =>
        matrixLoginBackground({
          address: account.address!,
          encryptedMnemonic: encMnemonic,
          callbacks: { onStatusUpdate: setStatusMessage, requestPin },
        }),
      );
    }
  }, [runTask, requestPin]);

  const getFlowCallbacks = useCallback(
    () => ({
      onStatusUpdate: setStatusMessage,
      requestPin,
    }),
    [requestPin],
  );

  return (
    <BackgroundSetupContext.Provider
      value={{
        status,
        statusMessage,
        error,
        inputRequest,
        startSetup,
        retry,
        dismiss,
        showDetails,
        setShowDetails,
        getFlowCallbacks,
        awaitCompletion,
      }}
    >
      {children}
      <BackgroundSetupModal />
    </BackgroundSetupContext.Provider>
  );
};

