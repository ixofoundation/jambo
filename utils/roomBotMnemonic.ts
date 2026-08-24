import { decrypt } from '@utils/encryption';
import { generateUserRoomAliasFromAddress } from '@utils/matrix';
import { getSecpClient } from '@utils/secp';
import { cleanUrlString } from '@utils/url';

export interface RoomBotMnemonicResponse {
  encryptedMnemonic: string;
  roomId: string;
}

export async function fetchEncryptedMnemonicFromRoomBot({
  roomBotUrl,
  address,
  sessionMnemonic,
  sessionAuthenticatorId,
}: {
  roomBotUrl: string;
  address: string;
  sessionMnemonic: string;
  sessionAuthenticatorId: string;
}): Promise<RoomBotMnemonicResponse> {
  if (!roomBotUrl) throw new Error('Recovery service not configured');
  if (!address) throw new Error('Address required to fetch encrypted mnemonic');
  if (!sessionMnemonic) throw new Error('Session mnemonic required to sign recovery challenge');
  if (!sessionAuthenticatorId) throw new Error('Session authenticator id required to authorize recovery');

  const challenge = Buffer.from(new Date().toISOString()).toString('base64');

  const secp = await getSecpClient(sessionMnemonic);
  const signatureBytes = await secp.sign(challenge);
  const signature = Buffer.from(signatureBytes).toString('base64');

  const url = cleanUrlString(`${roomBotUrl}/room/mnemonic`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomAlias: `did-ixo-${address}`,
      address,
      secpResult: { challenge, signature, authenticatorId: sessionAuthenticatorId },
    }),
  });

  if (!res.ok) {
    let errMsg = `Recovery request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) errMsg = body.error;
    } catch {
      // body not JSON — keep generic message
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as Partial<RoomBotMnemonicResponse>;
  if (!data?.encryptedMnemonic || !data?.roomId) {
    throw new Error('Recovery response missing encrypted mnemonic');
  }
  return { encryptedMnemonic: data.encryptedMnemonic, roomId: data.roomId };
}

/**
 * Fallback path: read the encrypted mnemonic directly from the user's personal matrix
 * room state event (ixo.room.state.secure / encrypted_mnemonic) using the existing
 * Matrix access token. Mirrors the read in screens/settings.tsx.
 */
export async function fetchEncryptedMnemonicFromRoom({
  homeServerUrl,
  accessToken,
  address,
}: {
  homeServerUrl: string;
  accessToken: string;
  address: string;
}): Promise<{ encryptedMnemonic: string; roomId: string }> {
  if (!homeServerUrl) throw new Error('Matrix homeserver not configured');
  if (!accessToken) throw new Error('Matrix access token missing');
  if (!address) throw new Error('Address required to fetch encrypted mnemonic');

  const roomAlias = generateUserRoomAliasFromAddress(address, homeServerUrl);
  const aliasRes = await fetch(
    cleanUrlString(`${homeServerUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!aliasRes.ok) throw new Error('Could not resolve user data store room');
  const { room_id: roomId } = (await aliasRes.json()) as { room_id: string };

  const stateRes = await fetch(
    cleanUrlString(
      `${homeServerUrl}/_matrix/client/r0/rooms/${encodeURIComponent(
        roomId,
      )}/state/ixo.room.state.secure/encrypted_mnemonic`,
    ),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!stateRes.ok) throw new Error('Could not fetch encrypted credentials from room state');
  const data = (await stateRes.json()) as { encrypted_mnemonic?: string };
  if (!data?.encrypted_mnemonic) throw new Error('No encrypted credentials found in room state');

  return { encryptedMnemonic: data.encrypted_mnemonic, roomId };
}

export function decryptEncryptedMnemonic(ciphertext: string, pin: string): string {
  let mnemonic: string;
  try {
    mnemonic = decrypt(ciphertext, pin);
  } catch {
    // A wrong PIN surfaces as a raw AES padding error ("unable to decrypt
    // data") — translate to the customer-facing message.
    throw new Error('Incorrect PIN. Please try again.');
  }
  // A wrong PIN can (rarely) pass the padding check but yield garbage rather
  // than a bip39 phrase — treat that as a wrong PIN too instead of silently
  // deriving wrong credentials from it.
  if (!mnemonic || !/^([a-z]+ ){11,23}[a-z]+$/.test(mnemonic.trim())) {
    throw new Error('Incorrect PIN. Please try again.');
  }
  return mnemonic;
}
