import { FC, ReactNode, useEffect, useRef } from 'react';

import { store } from '@store/index';
import { clearFlow, advanceStep, isStepBefore } from '@store/slices/setupFlowSlice';
import { hasVaultData, clearAllVaultData, readMnemonicFromVault, upgradeVaultToPinEncryption } from '@utils/setupVault';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { resumeRegisterBackground, resumeLoginBackground } from 'lib/auth/passkeyFlow';

interface SetupResumeProviderProps {
  children: ReactNode;
}

export const SetupResumeProvider: FC<SetupResumeProviderProps> = ({ children }) => {
  const { startSetup, getFlowCallbacks } = useBackgroundSetup();
  const auth = useAuth();
  const resumedRef = useRef(false);

  useEffect(() => {
    if (auth.isLoading) return;
    if (resumedRef.current) return;
    resumedRef.current = true;

    void checkAndResume().catch((err) => console.error('Setup resume failed:', err));
  }, [auth.isLoading]);

  async function checkAndResume() {
    const flowState = store.getState().setupFlow;

    // No active flow
    if (!flowState.flowType || flowState.currentStep === 'COMPLETE') {
      // Clean up any orphaned vault data
      if (hasVaultData()) {
        await clearAllVaultData();
        if (flowState.flowType) store.dispatch(clearFlow());
      }
      return;
    }

    // Active flow exists — attempt resume
    if (flowState.flowType === 'register') {
      await resumeRegistration(flowState);
    } else if (flowState.flowType === 'login') {
      await resumeLogin(flowState);
    }
  }

  async function resumeRegistration(flowState: ReturnType<typeof store.getState>['setupFlow']) {
    const { currentStep, address, did } = flowState;
    if (!currentStep || !address || !did) {
      // Insufficient state to resume — clean up
      await clearAllVaultData();
      store.dispatch(clearFlow());
      return;
    }

    // Check if vault data exists
    if (!hasVaultData()) {
      // Vault was cleared externally — can't resume
      store.dispatch(clearFlow());
      return;
    }

    // Determine if we need PIN (tier 2) or can use WebCrypto (tier 1)
    const needsPin = !isStepBefore(currentStep, 'PIN_COLLECTED', 'register');

    if (needsPin) {
      // Need PIN — use the background setup flow which will prompt for PIN
      startSetup(async () => {
        const callbacks = getFlowCallbacks();
        callbacks.onStatusUpdate('Resuming setup — PIN needed...');
        const pin = await callbacks.requestPin('pin-only');

        // Verify PIN works by trying to decrypt the wallet mnemonic
        try {
          const testRead = await readMnemonicFromVault('wallet', pin);
          if (!testRead) throw new Error('Vault read returned null');
        } catch {
          throw new Error('Incorrect PIN. Please try again.');
        }

        await resumeRegisterBackground({
          address,
          did,
          pin,
          currentStep,
          callbacks,
        });
      });
    } else {
      // WebCrypto tier — no PIN needed, but we still need to complete blocking steps
      // which may require user interaction (passkey prompt, PIN collection)
      // For now, start the background resume
      startSetup(async () => {
        const callbacks = getFlowCallbacks();
        callbacks.onStatusUpdate('Resuming account setup...');

        // Read wallet mnemonic with WebCrypto (no PIN needed)
        const walletMnemonic = await readMnemonicFromVault('wallet');
        if (!walletMnemonic) {
          throw new Error('Cannot resume — vault data not found');
        }

        // We need to get a PIN from the user to upgrade the vault before continuing
        callbacks.onStatusUpdate('PIN needed to secure your account...');
        const pin = await callbacks.requestPin();

        await upgradeVaultToPinEncryption(pin);
        store.dispatch(advanceStep('PIN_COLLECTED'));

        await resumeRegisterBackground({
          address,
          did,
          pin,
          currentStep: 'PIN_COLLECTED',
          callbacks,
        });
      });
    }
  }

  async function resumeLogin(flowState: ReturnType<typeof store.getState>['setupFlow']) {
    const { currentStep, address } = flowState;
    if (!currentStep || !address) {
      await clearAllVaultData();
      store.dispatch(clearFlow());
      return;
    }

    if (!hasVaultData()) {
      store.dispatch(clearFlow());
      return;
    }

    // For login, the encrypted mnemonic in the vault is already encrypted with the user's PIN
    // (from the original registration). The matrixLoginBackground will prompt for PIN.
    startSetup(async () => {
      const callbacks = getFlowCallbacks();
      try {
        await resumeLoginBackground({ address, currentStep, callbacks });
      } catch (err: any) {
        if (err.message === 'PASSKEY_REDO_NEEDED') {
          // Can't resume — need to redo passkey assertion
          await clearAllVaultData();
          store.dispatch(clearFlow());
          // User will naturally be redirected to passkey login
          return;
        }
        throw err;
      }
    });
  }

  return <>{children}</>;
};
