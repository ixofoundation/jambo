import { DefaultChainNetwork } from '../constants/common';

export interface OTPRequest {
  email: string;
  ixoAddress: string;
  network?: string;
}

export interface OTPVerification extends OTPRequest {
  otp: string;
}

export interface OTPResponse {
  message: string;
  expiresAt?: string;
  creationTime?: string;
}

export interface OTPStatusResponse {
  active: boolean;
  expiresAt?: string;
  creationTime?: string;
}

/**
 * Requests an OTP to be sent to the provided email
 * @param params - The email, address, and network
 * @returns The OTP request response
 */
export async function requestOTP(params: OTPRequest): Promise<OTPResponse> {
  const { email, ixoAddress, network = DefaultChainNetwork } = params;

  if (!email) {
    throw new Error('Email is required to request OTP');
  }
  if (!ixoAddress) {
    throw new Error('IXO address is required to request OTP');
  }

  try {
    const response = await fetch('/api/email/request-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        ixoAddress,
        network,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to request OTP: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('requestOTP::', (error as Error).message);
    throw error;
  }
}

/**
 * Verifies the OTP and grants feegrant on success
 * @param params - The email, address, OTP, and network
 * @returns The verification response
 */
export async function verifyOTP(params: OTPVerification): Promise<OTPResponse> {
  const { email, ixoAddress, otp, network = DefaultChainNetwork } = params;

  if (!email) {
    throw new Error('Email is required to verify OTP');
  }
  if (!ixoAddress) {
    throw new Error('IXO address is required to verify OTP');
  }
  if (!otp) {
    throw new Error('OTP is required for verification');
  }

  try {
    const response = await fetch('/api/email/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        ixoAddress,
        otp,
        network,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to verify OTP: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('verifyOTP::', (error as Error).message);
    throw error;
  }
}

/**
 * Queries the status of an OTP for a given email and address
 * @param params - The email, address, and network
 * @returns The OTP status
 */
export async function queryOTPStatus(params: OTPRequest): Promise<OTPStatusResponse> {
  const { email, ixoAddress, network = DefaultChainNetwork } = params;

  if (!email) {
    throw new Error('Email is required to query OTP status');
  }
  if (!ixoAddress) {
    throw new Error('IXO address is required to query OTP status');
  }

  try {
    const response = await fetch('/api/email/query-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        ixoAddress,
        network,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to query OTP status: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('queryOTPStatus::', (error as Error).message);
    throw error;
  }
}
