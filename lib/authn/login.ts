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
    throw new Error('Failed to fetch encrypted mnemonic');
  }

  const { encryptedMnemonic, roomId } = await response.json();

  return {
    encryptedMnemonic,
    roomId,
  };
}
