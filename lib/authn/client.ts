import { Fido2Lib } from 'fido2-lib';

export const fido2 = new Fido2Lib({
  timeout: 60000,
  rpId: process.env.NEXT_PUBLIC_AUTHN_RP_ID!,
  rpName: 'IXO Claims Demo',
  challengeSize: 64,
  attestation: 'none',
  cryptoParams: [-7, -257],
  // cryptoParams: [-257],
  authenticatorUserVerification: 'preferred',
  // is platform required or can also do cross-platform?
  // authenticatorAttachment: 'platform',
  // authenticatorRequireResidentKey: true,
});

// pubKeyCredParams: [
//     {
//       type: "public-key",
//       alg: -7 // "ES256"(ECDSA with SHA-256 on the P-256 curve) as registered in the IANA COSE Algorithms registry
//     },
//     {
//       type: "public-key",
//       alg: -257 // (RSASSA-PKCS1-v1_5 with SHA-256) Value registered by this specification for "RS256"
//     }
//   ],
