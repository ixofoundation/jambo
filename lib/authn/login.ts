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
    }),
  });

  if (!response.ok) {
    response.json().then(console.log).catch(console.error);
    throw new Error('Failed to fetch encrypted mnemonic');
  }

  const { encryptedMnemonic, roomId } = await response.json();

  return {
    encryptedMnemonic,
    roomId,
  };
}
