interface LoginPasskeyParams {
  address: string;
  authnResult: any;
}

export async function loginPasskey({ address, authnResult }: LoginPasskeyParams) {
  if (!address) {
    throw new Error('No address provided.');
  }

  // Verify and get encrypted mnemonic
  const response = await fetch(`/api/auth/get-secret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // roomAlias: `did-ixo-${address}`,
      authnResult: authnResult,
      address,
      rpId: process.env.NEXT_PUBLIC_AUTHN_RP_ID,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch encrypted mnemonic';
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // response body wasn't JSON
    }

    // Room exists but mnemonic state event was never saved (unrecoverable account)
    const isRoomAliasNotFound = errorMessage.includes('M_NOT_FOUND') && errorMessage.includes('Room alias');
    if (response.status === 404 && !isRoomAliasNotFound) {
      throw new Error('MNEMONIC_NOT_FOUND');
    }

    throw new Error(errorMessage);
  }

  const { encryptedMnemonic, roomId } = await response.json();

  return {
    encryptedMnemonic,
    roomId,
  };
}
