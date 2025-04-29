import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export function encrypt(text: string, password: string) {
  const iv = randomBytes(16);
  // @ts-ignore
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(password.padEnd(32)), iv);
  let encrypted = cipher.update(text);
  // @ts-ignore
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string, password: string) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex || '', 'hex');
  const encrypted = Buffer.from(encryptedHex || '', 'hex');
  // @ts-ignore
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(password.padEnd(32)), iv);
  // @ts-ignore
  let decrypted = decipher.update(encrypted);
  // @ts-ignore
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
