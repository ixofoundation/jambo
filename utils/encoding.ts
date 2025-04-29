export function base64urlEncode(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  let base64String = btoa(String.fromCharCode(...uint8Array));
  // Convert base64 to base64url
  base64String = base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base64String;
}

export function base64urlDecode(base64url: string): ArrayBuffer {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '='
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
