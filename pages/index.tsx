'use client';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import useSteps from '@hooks/useSteps';
import Long from 'long';
import { createQueryClient } from '@ixo/impactxclient-sdk';
import { decodeGrants, isAllowanceExpired, isAllowanceLimitReached, queryAddressAllowances } from '@utils/feegrant';
import { SecpClient } from '@utils/secp';
import { signAndBroadcastWithMnemonic } from '@utils/transaction';
import { signAndBroadcastWithPasskey } from 'lib/authn/signAndBroadcast';
import { signAndBroadcastWithSignX } from 'lib/authn/signAndBroadcastSignX';
import { useState } from 'react';
import Dashboard from 'screens/dashboard';
import LoginMethodSelector from 'screens/loginMethodSelector';
import LoginWithMnemonic from 'screens/loginMnemonic';
import LoginPasskey from 'screens/loginPasskey';
import LoginWithSignX from 'screens/loginSignX';
import RegisterPasskey from 'screens/registerPasskey';
import { CHAIN_RPC_URL } from '@constants/common';

enum STEPS {
  auth = 0,
  register = 1,
  login = 2,
  mnemonic = 3,
  signx = 4,
  dashboard = 9,
}

const STEPS_STATE = [STEPS.auth, STEPS.register, STEPS.login, STEPS.mnemonic, STEPS.signx, STEPS.dashboard];

export default function HomePage() {
  const [credentialId, setCredentialId] = useState('');
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const { step, reset, replace, goTo, goBack } = useSteps(STEPS_STATE, STEPS.auth);
  const [authenticatorId, setAuthenticatorId] = useState<string | undefined>();
  const [signXUser, setSignXUser] = useState<any>(null);

  const signingMethod: undefined | 'passkey' | 'mnemonic' | 'signx' = !credentialId
    ? undefined
    : credentialId === 'secp256k1'
    ? 'mnemonic'
    : credentialId === 'signx'
    ? 'signx'
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
      case 'signx':
        if (!signXUser) {
          throw new Error('SignX user not found');
        }
        return signAndBroadcastWithSignX({
          address: address!,
          messages,
          signXUser,
          feegrantGranter,
        });
      default:
        throw new Error('Unable to determine signing method');
    }
  }

  async function onAuthenticate() {
    switch (signingMethod) {
      case 'mnemonic': {
        const authenticatorType = 'SignatureVerification';
        const accounts = await wallet?.getAccounts();
        const pubkey = accounts?.[0]?.pubkey;
        if (!pubkey) {
          throw new Error('Unable to get pubkey');
        }
        // @ts-ignore
        const authenticatorData = new Uint8Array(Buffer.from(pubkey, 'hex'));
        return {
          type: authenticatorType,
          data: authenticatorData,
        };
      }
      case 'passkey': {
        const authenticatorType = 'AuthnVerification';
        const queryClient = await createQueryClient(CHAIN_RPC_URL);
        const response = await queryClient.ixo.smartaccount.v1beta1.getAuthenticator({
          account: address!,
          authenticatorId: Long.fromString(authenticatorId!),
        });
        console.log({ response });
        if (!response.accountAuthenticator?.config) {
          throw new Error('Unable to get authenticator data');
        }
        const authenticatorData = Buffer.from(response.accountAuthenticator?.config).toString('hex');
        return {
          type: authenticatorType,
          data: authenticatorData,
        };
      }
      case 'signx': {
        // For SignX, we don't need additional authentication as the user is already authenticated via SignX
        const authenticatorType = 'SignXVerification';
        const authenticatorData = new Uint8Array(Buffer.from(signXUser?.address || '', 'utf8'));
        return {
          type: authenticatorType,
          data: authenticatorData,
        };
      }
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

  function onLoginSignX({
    address,
    did,
    credentialId,
    signXUser,
  }: {
    address: string;
    did: string;
    credentialId: string;
    signXUser: any;
  }) {
    setCredentialId(credentialId);
    setAddress(address);
    setDid(did);
    setSignXUser(signXUser);
    reset(STEPS.dashboard);
  }

  function handleSelectMethod(method: 'register' | 'login' | 'mnemonic' | 'signx') {
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
      case 'signx':
        goTo(STEPS.signx);
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
      ) : step === STEPS.signx ? (
        // @ts-ignore
        <LoginWithSignX onLogin={onLoginSignX} onBack={() => goBack()} />
      ) : step === STEPS.dashboard ? (
        // @ts-ignore
        <Dashboard
          did={did!}
          address={address!}
          method={signingMethod!}
          onSign={onSign}
          onAuthenticate={onAuthenticate}
        />
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
