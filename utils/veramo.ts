import { generateKeyPairFromSeed } from '@stablelib/ed25519';
import { sha256 } from '@cosmjs/crypto';
import base58 from 'bs58';

export function deriveEd25519KeyPairFromMnemonic(mnemonic: string): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  const seed = sha256(new TextEncoder().encode(mnemonic)).slice(0, 32);
  const keyPair = generateKeyPairFromSeed(seed);
  return { publicKey: keyPair.publicKey, secretKey: keyPair.secretKey };
}

export function publicKeyToMultibase(publicKey: Uint8Array): string {
  const multicodecPrefix = new Uint8Array([0xed, 0x01]);
  const combined = new Uint8Array(multicodecPrefix.length + publicKey.length);
  combined.set(multicodecPrefix);
  combined.set(publicKey, multicodecPrefix.length);
  return 'z' + base58.encode(combined);
}

export async function createVeramoAgent(
  keyPair: { publicKey: Uint8Array; secretKey: Uint8Array },
  did: string,
) {
  const { createAgent } = await import(/* webpackChunkName: "veramo" */ '@veramo/core');
  const { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } = await import(/* webpackChunkName: "veramo" */ '@veramo/key-manager');
  const { KeyManagementSystem } = await import(/* webpackChunkName: "veramo" */ '@veramo/kms-local');
  const { DIDManager, MemoryDIDStore } = await import(/* webpackChunkName: "veramo" */ '@veramo/did-manager');
  const { DIDResolverPlugin } = await import(/* webpackChunkName: "veramo" */ '@veramo/did-resolver');
  const { CredentialPlugin } = await import(/* webpackChunkName: "veramo" */ '@veramo/credential-w3c');
  const { CredentialIssuerLD, LdDefaultContexts, VeramoEd25519Signature2018 } = await import(
    /* webpackChunkName: "veramo" */ '@veramo/credential-ld'
  );
  const { Resolver } = await import(/* webpackChunkName: "veramo" */ 'did-resolver');

  const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
  const privateKeyHex = Buffer.from(keyPair.secretKey).toString('hex');
  const publicKeyBase58 = base58.encode(keyPair.publicKey);
  const kid = `${did}#${publicKeyBase58}`;

  // Custom resolver that returns a minimal DID document for the user's DID
  const ixoDidResolver = {
    ixo: async (didUrl: string) => {
      const didOnly = didUrl.split('#')[0].split('?')[0];
      return {
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
        didDocumentMetadata: {},
        didDocument: {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: didOnly,
          verificationMethod: [
            {
              id: kid,
              type: 'Ed25519VerificationKey2018',
              controller: didOnly,
              publicKeyBase58: publicKeyBase58,
            },
          ],
          authentication: [kid],
          assertionMethod: [kid],
        },
      };
    },
  };

  const agent = createAgent({
    plugins: [
      new KeyManager({
        store: new MemoryKeyStore(),
        kms: {
          local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
        },
      }),
      new DIDManager({
        store: new MemoryDIDStore(),
        defaultProvider: 'did:ixo',
        providers: {},
      }),
      new DIDResolverPlugin({
        resolver: new Resolver(ixoDidResolver, { cache: false }),
      }),
      new CredentialPlugin(),
      new CredentialIssuerLD({
        contextMaps: [LdDefaultContexts],
        suites: [new VeramoEd25519Signature2018()],
      }),
    ],
  });

  await agent.keyManagerImport({
    kid,
    kms: 'local',
    type: 'Ed25519',
    publicKeyHex,
    privateKeyHex,
  });

  await agent.didManagerImport({
    did,
    provider: 'did:ixo',
    controllerKeyId: kid,
    keys: [
      {
        kid,
        kms: 'local',
        type: 'Ed25519',
        publicKeyHex,
        privateKeyHex,
      },
    ],
  });

  return agent;
}

export async function signClaimCredential(
  agent: Awaited<ReturnType<typeof createVeramoAgent>>,
  userDid: string,
  surveyData: Record<string, any>,
) {
  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'ClaimCredential'],
    issuer: userDid,
    credentialSubject: {
      id: userDid,
      type: ['ClaimCredential'],
      ...surveyData,
    },
  };

  const verifiableCredential = await agent.createVerifiableCredential({
    credential,
    proofFormat: 'lds',
  });

  return verifiableCredential;
}
