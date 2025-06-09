import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { Grant } from '@ixo/impactxclient-sdk/types/codegen/cosmos/feegrant/v1beta1/feegrant';
import { Timestamp } from '@ixo/impactxclient-sdk/types/codegen/google/protobuf/timestamp';
import { Coin } from '@cosmjs/proto-signing';
import { DecodeObject } from '@cosmjs/proto-signing';

import { CHAIN_RPC_URL } from '../constants/common';
import { convertTimestampObjectToTimestamp } from './timestamp';

export enum FeegrantTypes {
  BASIC_ALLOWANCE = 'BasicAllowance',
  PERIODIC_ALLOWANCE = 'PeriodicAllowance',
}

export const FEEGRANT_TYPES: Record<FeegrantTypes, string> = {
  BasicAllowance: '/cosmos.feegrant.v1beta1.BasicAllowance',
  PeriodicAllowance: '/cosmos.feegrant.v1beta1.PeriodicAllowance',
};

/**
 * Grants feegrant to the address via email OTP verification
 * @param address - The address to grant feegrant to
 * @param email - The email address for OTP verification
 * @param otp - The OTP code from email
 * @returns The response from the feegrant grant
 */
export async function grantAddressFeegrantWithEmail(address: string, email: string, otp: string) {
  // Import here to avoid circular dependency
  const { verifyOTP } = await import('./emailOtp');

  try {
    const response = await verifyOTP({
      email,
      ixoAddress: address,
      otp,
    });
    return response;
  } catch (error) {
    console.error('grantAddressFeegrantWithEmail::', (error as Error).message);
    throw error;
  }
}

/**
 * Grants feegrant to the address via email OTP if the account does not have a valid feegrant
 * This function now requires email verification instead of the old direct API call
 * @param address - The address to grant feegrant to
 * @param email - The email address for verification (optional, used only if feegrant needed)
 * @param otp - The OTP code (optional, used only if feegrant needed)
 * @returns True if feegrant exists or was successfully granted
 */
export async function grantAddressFeegrantIfNotExists({
  address,
  email,
  otp,
}: {
  address: string;
  email?: string;
  otp?: string;
}) {
  if (!address) {
    throw new Error('Address is required to grant feegrant - who should be sponsored?');
  }

  let hasFeegrant = await checkAddressFeegrant(address);

  if (!hasFeegrant) {
    if (!email || !otp) {
      throw new Error('Email and OTP are required to grant feegrant for new addresses');
    }
    await grantAddressFeegrantWithEmail(address, email, otp);
    hasFeegrant = await checkAddressFeegrant(address);
  }

  return hasFeegrant;
}

/**
 * Legacy function - kept for backward compatibility but now throws error
 * @deprecated Use grantAddressFeegrantWithEmail instead
 */
export async function grantAddressFeegrant(address: string) {
  throw new Error('Direct feegrant granting is no longer supported. Please use email OTP verification.');
}

/**
 * Queries the address allowances from the IXO blockchain
 * @param address - The address to query allowances for
 * @returns The allowances for the address
 */
export async function queryAddressAllowances(address: string) {
  try {
    const queryClient = await createQueryClient(CHAIN_RPC_URL);
    const allowancesResponse = await queryClient.cosmos.feegrant.v1beta1.allowances({
      grantee: address,
    });
    return allowancesResponse?.allowances ?? [];
  } catch (error) {
    console.error('queryAddressAllowances::', (error as Error).message);
    return undefined;
  }
}

/**
 * Checks if the address has a valid feegrant (not expired yet and limit not reached yet)
 * @param address - The address to check feegrant for
 * @returns True if the address has a valid feegrant, false otherwise
 */
export async function checkAddressFeegrant(address: string) {
  try {
    const allowancesResponse = await queryAddressAllowances(address);
    console.log('allowancesResponse', allowancesResponse);
    if (!allowancesResponse?.length) {
      return false;
    }
    const allowances = decodeGrants(allowancesResponse);
    return allowances.some(
      (allowance) =>
        !!allowance && !isAllowanceExpired(allowance.expiration as number) && !isAllowanceLimitReached(allowance.limit),
    );
  } catch (error) {
    console.error('checkAddressFeegrant::', (error as Error).message);
    throw error;
  }
}

/**
 * Decodes the grant values from the the user's list of allowances
 * @param grants - The grants to decode
 * @returns The decoded grants
 */
export const decodeGrants = (grants: Grant[]) => {
  const registry = createRegistry();

  return (grants ?? []).map((grant) => {
    const allowance = grant.allowance as DecodeObject;
    const decodedAllowance = registry.decode(allowance);
    // decodedAllowance.
    switch (allowance.typeUrl) {
      case FEEGRANT_TYPES.BasicAllowance:
        return {
          granter: grant.granter,
          grantee: grant.grantee,
          type: FEEGRANT_TYPES.BasicAllowance,
          expiration: decodedAllowance.expiration
            ? convertTimestampObjectToTimestamp(decodedAllowance.expiration)
            : null,
          limit: decodedAllowance.spendLimit?.length
            ? decodedAllowance.spendLimit.find((limit: Coin) => limit.denom === 'uixo')?.amount
            : null,
          msgs: [],
        };
      case FEEGRANT_TYPES.PeriodicAllowance:
        return {
          granter: grant.granter,
          grantee: grant.grantee,
          type: FEEGRANT_TYPES.PeriodicAllowance,
          expiration: decodedAllowance.basic?.expiration
            ? convertTimestampObjectToTimestamp(decodedAllowance.basic.expiration)
            : null,
          limit: decodedAllowance?.periodCanSpend
            ? decodedAllowance?.periodCanSpend?.find((limit: Coin) => limit.denom === 'uixo')?.amount
            : decodedAllowance?.basic?.spendLimit?.length
            ? decodedAllowance?.basic?.spendLimit?.find((limit: Coin) => limit.denom === 'uixo')?.amount
            : null,
          msgs: [],
        };
      default:
        return {
          type: allowance.typeUrl,
          granter: grant.granter,
          grantee: grant.grantee,
          expiration: decodedAllowance.expiration
            ? convertTimestampObjectToTimestamp(decodedAllowance.expiration)
            : decodedAllowance.basic?.expiration
            ? convertTimestampObjectToTimestamp(decodedAllowance.basic.expiration)
            : null,
          limit: decodedAllowance.spendLimit?.length
            ? decodedAllowance.spendLimit.find((limit: Coin) => limit.denom === 'uixo')?.amount
            : decodedAllowance?.periodCanSpend
            ? decodedAllowance?.periodCanSpend?.find((limit: Coin) => limit.denom === 'uixo')?.amount
            : decodedAllowance?.basic?.spendLimit?.length
            ? decodedAllowance?.basic?.spendLimit?.find((limit: Coin) => limit.denom === 'uixo')?.amount
            : null,
          msgs: decodedAllowance.allowedMessages,
        };
    }
  });
};

/**
 * Checks if the allowance has expired
 * @param expiration - The expiration of the allowance
 * @returns True if the allowance has expired, false otherwise
 */
export const isAllowanceExpired = (expiration: number | Timestamp) => {
  if (expiration === null || expiration === undefined) {
    return false;
  }
  const expirationTimestamp =
    typeof expiration === 'object' ? convertTimestampObjectToTimestamp(expiration) : expiration;
  if (expirationTimestamp === undefined || expirationTimestamp === null) {
    // failed to decode or convert - assume expired
    return true;
  }
  return expirationTimestamp < Date.now();
};

/**
 * Checks if the allowance limit has been reached
 * @param limit - The limit of the allowance
 * @returns True if the allowance limit has been reached, false otherwise
 */
export const isAllowanceLimitReached = (limit: number | string | Coin) => {
  if (limit === null || limit === undefined) {
    return false;
  }
  const limitAmount =
    typeof limit === 'object' ? Number(limit?.amount ?? 0) : typeof limit === 'string' ? Number(limit ?? 0) : limit;
  return limitAmount <= 0.0005;
};
