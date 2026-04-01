import { createContext } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import type { AuthHubSessionData } from 'lib/authHub/redirect';

export interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  address: string | null;
  did: string | null;
  displayName: string | null;
  sessionAuthenticatorId: string | null;
  matrixUserId: string | null;
  matrixRoomId: string | null;
  loginWithAuthHub: (data: AuthHubSessionData) => void;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: true,
  address: null,
  did: null,
  displayName: null,
  sessionAuthenticatorId: null,
  matrixUserId: null,
  matrixRoomId: null,
  loginWithAuthHub: () => {},
  onSign: () => Promise.reject(new Error('AuthProvider not mounted')),
  logout: () => Promise.reject(new Error('AuthProvider not mounted')),
});
