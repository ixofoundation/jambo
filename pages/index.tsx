'use client';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import useSteps from '@hooks/useSteps';
import { decodeGrants, isAllowanceExpired, isAllowanceLimitReached, queryAddressAllowances } from '@utils/feegrant';
import { SecpClient } from '@utils/secp';
import { signAndBroadcastWithMnemonic } from '@utils/transaction';
import { signAndBroadcastWithPasskey } from 'lib/authn/signAndBroadcast';
import { useState } from 'react';
import Dashboard from 'screens/dashboard';
import LoginMethodSelector from 'screens/loginMethodSelector';
import LoginWithMnemonic from 'screens/loginMnemonic';
import LoginPasskey from 'screens/loginPasskey';
import RegisterPasskey from 'screens/registerPasskey';

enum STEPS {
  auth = 0,
  register = 1,
  login = 2,
  mnemonic = 3,
  dashboard = 9,
}

const STEPS_STATE = [STEPS.auth, STEPS.register, STEPS.login, STEPS.mnemonic, STEPS.dashboard];

export default function HomePage() {
  const [credentialId, setCredentialId] = useState('');
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const { step, reset, replace, goTo, goBack } = useSteps(STEPS_STATE, STEPS.auth);
  const [authenticatorId, setAuthenticatorId] = useState<string | undefined>();

  const signingMethod: undefined | 'passkey' | 'mnemonic' = !credentialId
    ? undefined
    : credentialId === 'secp256k1'
    ? 'mnemonic'
    : 'passkey';

  async function onSign(messages: any[]) {
    console.log('onSign', signingMethod, messages);
    if (!signingMethod) {
      throw new Error('Unable to determine signing method');
    }
    let feegrantGranter: string | undefined;
    try {
      const allowances = await queryAddressAllowances(address!);
      feegrantGranter = allowances?.length
        ? decodeGrants(allowances)?.find(
            (allowance) =>
              !!allowance &&
              !isAllowanceExpired(allowance.expiration as number) &&
              !isAllowanceLimitReached(allowance.limit),
          )?.granter
        : undefined;
    } catch (error) {
      // silent fail
      console.error(error);
    }
    console.log('feegrantGranter', feegrantGranter);
    switch (signingMethod) {
      case 'passkey':
        return signAndBroadcastWithPasskey({
          address: address!,
          messages,
          credentialId,
          authenticatorId,
          feegrantGranter,
        });
      case 'mnemonic':
        return signAndBroadcastWithMnemonic({
          offlineSigner: wallet!,
          messages,
          feegrantGranter,
        });
      default:
        throw new Error('Unable to determine signing method');
    }
  }

  function onRegisterPasskey({
    address,
    did,
    credentialId,
    authenticatorId,
  }: {
    address: string;
    did: string;
    credentialId: string;
    authenticatorId?: string;
  }) {
    setCredentialId(credentialId);
    if (authenticatorId) {
      setAuthenticatorId(authenticatorId);
    }
    setAddress(address);
    setDid(did);
    reset(STEPS.dashboard);
  }

  function onLoginPasskey({
    credentialId,
    authenticatorId,
    address,
    did,
  }: {
    credentialId: string;
    authenticatorId?: string;
    address: string;
    did: string;
  }) {
    setCredentialId(credentialId);
    setAuthenticatorId(authenticatorId);
    setAddress(address);
    setDid(did);
    reset(STEPS.dashboard);
  }

  function onLoginMnemonic({
    wallet,
    credentialId,
    address,
    did,
  }: {
    wallet: SecpClient;
    credentialId: string;
    address: string;
    did: string;
  }) {
    setWallet(wallet);
    setCredentialId(credentialId);
    setAddress(address);
    setDid(did);
    reset(STEPS.dashboard);
  }

  function handleSelectMethod(method: 'register' | 'login' | 'mnemonic') {
    switch (method) {
      case 'register':
        goTo(STEPS.register);
        break;
      case 'login':
        goTo(STEPS.login);
        break;
      case 'mnemonic':
        goTo(STEPS.mnemonic);
        break;
      default:
        console.error('Invalid method', method);
        break;
    }
  }

  return (
    <>
      {step === STEPS.auth ? (
        // @ts-ignore
        <LoginMethodSelector onSelectMethod={handleSelectMethod} />
      ) : step === STEPS.register ? (
        // @ts-ignore
        <RegisterPasskey onRegister={onRegisterPasskey} onBack={() => goBack()} />
      ) : step === STEPS.login ? (
        // @ts-ignore
        <LoginPasskey onLogin={onLoginPasskey} onBack={() => goBack()} />
      ) : step === STEPS.mnemonic ? (
        // @ts-ignore
        <LoginWithMnemonic onLogin={onLoginMnemonic} onBack={() => goBack()} />
      ) : step === STEPS.dashboard ? (
        // @ts-ignore
        <Dashboard did={did!} address={address!} onSign={onSign} />
      ) : (
        <>
          <h2>Something went wrong.</h2>
          {/* @ts-ignore */}
          <Button
            color={BUTTON_COLOR.primary}
            size={BUTTON_SIZE.medium}
            bgColor={BUTTON_BG_COLOR.primary}
            label='Home'
            onClick={() => window.location.reload()}
          />
        </>
      )}
    </>
  );
}
