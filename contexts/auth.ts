import { createContext } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { SecpClient } from '@utils/secp';

export type SigningMethod = 'passkey' | 'mnemonic' | 'signx' | undefined;

export interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  credentialId: string;
  address: string | null;
  did: string | null;
  authenticatorId: string | undefined;
  signingMethod: SigningMethod;
  wallet: SecpClient | null;
  signXUser: any;
  loginWithPasskey: (data: {
    credentialId: string;
    authenticatorId?: string;
    address: string;
    did: string;
  }) => void;
  registerWithPasskey: (data: {
    address: string;
    did: string;
    credentialId: string;
    authenticatorId?: string;
  }) => void;
  loginWithMnemonic: (data: {
    wallet: SecpClient;
    credentialId: string;
    address: string;
    did: string;
  }) => void;
  loginWithSignX: (data: {
    address: string;
    did: string;
    credentialId: string;
    signXUser: any;
  }) => void;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
  onAuthenticate: () => Promise<{ type: string; data: any }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: true,
  credentialId: '',
  address: null,
  did: null,
  authenticatorId: undefined,
  signingMethod: undefined,
  wallet: null,
  signXUser: null,
  loginWithPasskey: () => {},
  registerWithPasskey: () => {},
  loginWithMnemonic: () => {},
  loginWithSignX: () => {},
  onSign: () => Promise.reject(new Error('AuthProvider not mounted')),
  onAuthenticate: () => Promise.reject(new Error('AuthProvider not mounted')),
  logout: () => Promise.reject(new Error('AuthProvider not mounted')),
});
