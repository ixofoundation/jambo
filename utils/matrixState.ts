import { createMatrixStateBotClient } from '@ixo/matrixclient-sdk';

import { MATRIX_STATE_BOT_URL } from '@constants/kyc';
import { cleanUrlString } from '@utils/url';
import { generateUserRoomAliasFromAddress, getMatrixOpenIdToken } from '@utils/matrix';

type StateBotClient = ReturnType<typeof createMatrixStateBotClient>;

let cachedClient: { key: string; client: StateBotClient } | null = null;

function getMatrixStateBotClient(accessToken: string, homeServerUrl: string): StateBotClient {
  if (!MATRIX_STATE_BOT_URL) throw new Error('Matrix state bot URL not configured');
  const key = `${homeServerUrl}|${MATRIX_STATE_BOT_URL}|${accessToken}`;
  if (cachedClient?.key === key) return cachedClient.client;
  const client = createMatrixStateBotClient({
    homeServerUrl,
    botUrl: MATRIX_STATE_BOT_URL,
    accessToken,
  });
  cachedClient = { key, client };
  return client;
}

async function resolveUserRoomId(address: string, homeServerUrl: string, accessToken: string): Promise<string> {
  const roomAlias = generateUserRoomAliasFromAddress(address, homeServerUrl);
  const res = await fetch(
    cleanUrlString(`${homeServerUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('Could not resolve user data-store room');
  const { room_id } = await res.json();
  if (!room_id) throw new Error('User data-store room has no room_id');
  return room_id as string;
}

export async function saveCredentialToMatrix({
  address,
  did,
  accessToken,
  homeServerUrl,
  credentialType,
  credential,
}: {
  address: string;
  did: string;
  accessToken: string;
  homeServerUrl: string;
  credentialType: string;
  credential: unknown;
}): Promise<void> {
  const roomId = await resolveUserRoomId(address, homeServerUrl, accessToken);
  const openIdToken = await getMatrixOpenIdToken();
  const client = getMatrixStateBotClient(accessToken, homeServerUrl);
  const path = '/' + credentialType.replace(/^\/+/, '');
  await client.state.v1beta1.setState(
    roomId,
    'credentials',
    path,
    JSON.stringify(credential),
    openIdToken,
    did,
  );
}
