import { createContext } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import type { AuthHubSessionData } from 'lib/authHub/redirect';

export interface OnSignOptions {
  memo?: string;
  /** Gas limit for the transaction, when the default does not fit the message. */
  gas?: number;
  onSigned?: (txHash: string) => void | Promise<void>;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  address: string | null;
  did: string | null;
  displayName: string | null;
  /** Auth-hub email (display only); null for sessions from before the hub returned it. */
  email: string | null;
  /**
   * How the account signs in: 'workos' (IXO sign-in) or a direct provider id
   * ('yoma'); null for sessions from before the hub returned it. Decides the
   * logout and the PIN reset (lib/authHub/provider).
   */
  authProvider: string | null;
  sessionAuthenticatorId: string | null;
  matrixUserId: string | null;
  matrixRoomId: string | null;
  loginWithAuthHub: (data: AuthHubSessionData) => void;
  /** `label`: what the signing modal says (defaults to one derived from the message type).
   *  `options.memo`: the tx memo (shown by wallets/explorers); `options.onSigned`: called with
   *  the tx hash after signing and BEFORE broadcast (lib/authHub/signAndBroadcast). Failures
   *  throw `SignBroadcastError` (its `stage` says whether anything may have moved). */
  onSign: (messages: any[], label?: string, options?: OnSignOptions) => Promise<DeliverTxResponse>;
  /**
   * `preserveReturnTo` = "switch account": keep the deep link + Yoma hand-off
   * marker, and for a Yoma account start a fresh Yoma sign-in (`prompt=login`)
   * after the hub and Yoma have signed the person out.
   */
  logout: (options?: { preserveReturnTo?: boolean }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: true,
  address: null,
  did: null,
  displayName: null,
  email: null,
  authProvider: null,
  sessionAuthenticatorId: null,
  matrixUserId: null,
  matrixRoomId: null,
  loginWithAuthHub: () => {},
  onSign: () => Promise.reject(new Error('AuthProvider not mounted')),
  logout: () => Promise.reject(new Error('AuthProvider not mounted')),
});
