import cbor from 'cbor';

export function extractDataFromAuthData(authDataBuffer: any) {
	let authData: DataView<any> | null = null;
	if (authDataBuffer?.constructor?.name === 'Uint8Array') {
		authData = new DataView(authDataBuffer.buffer, authDataBuffer.byteOffset, authDataBuffer.byteLength);
	} else if (authDataBuffer?.constructor?.name === 'Buffer') {
		const uint8Array = new Uint8Array(authDataBuffer);
		authData = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
	} else if (authDataBuffer?.constructor?.name === 'ArrayBuffer') {
		authData = new DataView(authDataBuffer);
	} else {
		throw new Error('Invalid authDataBuffer type');
	}

	let offset = 0;
	// rpIdHash: 32 bytes
	const rpIdHash = authDataBuffer.slice(offset, offset + 32);
	console.log({ rpIdHash: rpIdHash.toString('hex') });
	// Skip rpIdHash (32 bytes)
	offset += 32;
	// Read flags (1 byte)
	const flags = authData.getUint8(offset);
	offset += 1;
	// Skip signCount (4 bytes)
	offset += 4;

	// Check if attestedCredentialData is present
	const attestedCredentialDataPresent = (flags & 0x40) !== 0;
	if (!attestedCredentialDataPresent) {
		throw new Error('Attested credential data not present in authData');
	}

	// AttestedCredentialData
	// - aaguid: 16 bytes
	// - credentialIdLength: 2 bytes
	// - credentialId: variable length
	// - credentialPublicKey: variable length (CBOR encoded)

	// Skip aaguid (16 bytes)
	offset += 16;
	// Get credentialIdLength (2 bytes)
	const credentialIdLength = authData.getUint16(offset);
	offset += 2;
	// Skip credentialId
	// const credentialId = authDataBuffer.slice(offset, offset + credentialIdLength);
	offset += credentialIdLength;

	// The rest is the credentialPublicKey (CBOR encoded)
	const publicKeyBytes = authDataBuffer.slice(offset);

	// Decode the public key from COSE_Key format
	const cosePublicKey = cbor.decodeAllSync(publicKeyBytes)[0];

	// Extract key parameters based on COSE_Key format for EC2 keys
	const keyType = cosePublicKey.get(1);
	const algorithm = cosePublicKey.get(3);
	const curve = cosePublicKey.get(-1);
	// const x = cosePublicKey.get(-2);
	// const y = cosePublicKey.get(-3);
	console.log({ keyType, algorithm, curve });
	return { keyType, algorithm, curve, rpIdHash };

	// if (keyType !== 2 || curve !== 1) {
	// 	throw new Error('Unsupported key type or curve');
	// }

	// // Convert x and y to Uint8Array
	// const xBytes = new Uint8Array(x);
	// const yBytes = new Uint8Array(y);

	// // Now, create a compressed public key:
	// // - The first byte is 0x02 if y is even, 0x03 if y is odd
	// // - The rest is x coordinate

	// const yIsEven = (yBytes[yBytes.length - 1] & 1) === 0;
	// const prefix = yIsEven ? 0x02 : 0x03;

	// const compressedPublicKey = new Uint8Array(1 + xBytes.length);
	// compressedPublicKey[0] = prefix;
	// compressedPublicKey.set(xBytes, 1);

	// return compressedPublicKey;
}
