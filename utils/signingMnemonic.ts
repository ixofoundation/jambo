import { utils } from '@ixo/impactxclient-sdk';

import { encrypt, decrypt } from '@utils/encryption';
import { generateUserRoomAliasFromAddress } from '@utils/matrix';
import { cleanUrlString } from '@utils/url';

export function generateSigningMnemonic(): string {
  return utils.mnemonic.generateMnemonic(24);
}

export async function resolveUserMatrixRoomId(
  address: string,
  accessToken: string,
  homeServerUrl: string,
): Promise<string> {
  const roomAlias = generateUserRoomAliasFromAddress(address, homeServerUrl);
  const aliasRes = await fetch(
    cleanUrlString(`${homeServerUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!aliasRes.ok) throw new Error('Could not resolve Matrix room');
  const { room_id } = await aliasRes.json();
  return room_id;
}

export async function fetchEncryptedSigningMnemonic(
  roomId: string,
  accessToken: string,
  homeServerUrl: string,
): Promise<string | null> {
  const res = await fetch(
    cleanUrlString(`${homeServerUrl}/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/ixo.room.state.secure/encrypted_signing_mnemonic`),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.encrypted_signing_mnemonic ?? null;
}

export async function storeEncryptedSigningMnemonic(
  roomId: string,
  mnemonic: string,
  pin: string,
  accessToken: string,
  homeServerUrl: string,
): Promise<void> {
  const encrypted = encrypt(mnemonic, pin);
  const res = await fetch(
    cleanUrlString(`${homeServerUrl}/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/ixo.room.state.secure/encrypted_signing_mnemonic`),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ encrypted_signing_mnemonic: encrypted }),
    },
  );
  if (!res.ok) throw new Error('Failed to store encrypted signing mnemonic');
}

export function decryptSigningMnemonic(encryptedMnemonic: string, pin: string): string {
  return decrypt(encryptedMnemonic, pin);
}
