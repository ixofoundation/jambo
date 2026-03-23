/**
 * Secure transient mnemonic vault for the setup flow.
 *
 * Two encryption tiers:
 *   Tier 1 (WebCrypto) — non-extractable AES-256-GCM key in IndexedDB.
 *     Used before the user has chosen a PIN.
 *   Tier 2 (PIN)       — AES-256-GCM with a PBKDF2-derived key from the user's PIN.
 *     Replaces tier-1 once the user provides a PIN after passkey registration.
 *
 * Data is stored in localStorage; keys/metadata in IndexedDB.
 * Everything is wiped on flow completion, logout, or new-flow start.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const IDB_NAME = 'jambo-setup-vault';
const IDB_STORE = 'keys';
const IDB_KEY_ID = 'setup-encryption-key';

const LS_PREFIX = 'jambo_setup_';
const LS_TIER_KEY = `${LS_PREFIX}tier`;

export type VaultSlot = 'wallet' | 'matrix';
type VaultTier = 'webcrypto' | 'pin' | 'upgrading';

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeKeyInIDB(key: CryptoKey): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(key, IDB_KEY_ID);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function loadKeyFromIDB(): Promise<CryptoKey | null> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY_ID);
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

async function deleteVaultKey(): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY_ID);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // IDB may already be gone — that's fine
  }
  // Also try to delete the entire database
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // proceed even if blocked
    });
  } catch {
    // best-effort
  }
}

// ─── Tier 1: Web Crypto ─────────────────────────────────────────────────────

async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false /* non-extractable */, [
    'encrypt',
    'decrypt',
  ]);
}

async function encryptWithVaultKey(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return hexEncode(iv) + ':' + hexEncode(new Uint8Array(cipherBuf));
}

async function decryptWithVaultKey(key: CryptoKey, data: string): Promise<string> {
  const parts = data.split(':');
  if (parts.length !== 2) throw new Error('Invalid vault data format');
  const [ivHex, cipherHex] = parts;
  const iv = hexDecode(ivHex);
  const cipher = hexDecode(cipherHex);
  // @ts-ignore
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plainBuf);
}

// ─── Tier 2: PIN-based (PBKDF2 + AES-256-GCM) ──────────────────────────────

const PBKDF2_ITERATIONS = 100_000;

async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    // @ts-ignore
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptWithPin(plaintext: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPin(pin, salt);
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return hexEncode(salt) + ':' + hexEncode(iv) + ':' + hexEncode(new Uint8Array(cipherBuf));
}

export async function decryptWithPin(data: string, pin: string): Promise<string> {
  const parts = data.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const [saltHex, ivHex, cipherHex] = parts;
  const salt = hexDecode(saltHex);
  const iv = hexDecode(ivHex);
  const cipher = hexDecode(cipherHex);
  const key = await deriveKeyFromPin(pin, salt);
  // @ts-ignore
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plainBuf);
}

// ─── localStorage storage ────────────────────────────────────────────────────

export function saveToVault(slotId: VaultSlot, data: string): void {
  localStorage.setItem(`${LS_PREFIX}${slotId}`, data);
}

export function loadFromVault(slotId: VaultSlot): string | null {
  return localStorage.getItem(`${LS_PREFIX}${slotId}`);
}

export function clearVaultSlot(slotId: VaultSlot): void {
  localStorage.removeItem(`${LS_PREFIX}${slotId}`);
}

export async function clearAllVaultData(): Promise<void> {
  // Remove all vault entries from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LS_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Delete WebCrypto key from IDB
  await deleteVaultKey();
}

export function hasVaultData(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LS_PREFIX)) return true;
  }
  return false;
}

// ─── Vault tier ──────────────────────────────────────────────────────────────

function getVaultTier(): VaultTier {
  return (localStorage.getItem(LS_TIER_KEY) as VaultTier) || 'webcrypto';
}

function setVaultTier(tier: VaultTier): void {
  localStorage.setItem(LS_TIER_KEY, tier);
}

// ─── High-level: Save mnemonic with WebCrypto (tier 1) ──────────────────────

export async function saveMnemonicWithWebCrypto(slotId: VaultSlot, mnemonic: string): Promise<void> {
  let key = await loadKeyFromIDB();
  if (!key) {
    key = await generateVaultKey();
    await storeKeyInIDB(key);
  }
  const encrypted = await encryptWithVaultKey(key, mnemonic);
  saveToVault(slotId, encrypted);
  setVaultTier('webcrypto');
}

// ─── High-level: Upgrade vault from WebCrypto to PIN ─────────────────────────

export async function upgradeVaultToPinEncryption(pin: string): Promise<void> {
  // Idempotent — if already upgraded, nothing to do
  if (getVaultTier() === 'pin') return;

  const vaultKey = await loadKeyFromIDB();
  if (!vaultKey) {
    throw new Error('No WebCrypto key found — cannot upgrade vault');
  }

  // Mark as upgrading so a crash mid-upgrade is detectable
  setVaultTier('upgrading');

  const slots: VaultSlot[] = ['wallet', 'matrix'];
  for (const slot of slots) {
    const encrypted = loadFromVault(slot);
    if (!encrypted) continue;

    // Decrypt with WebCrypto key
    const plaintext = await decryptWithVaultKey(vaultKey, encrypted);
    // Re-encrypt with PIN
    const pinEncrypted = await encryptWithPin(plaintext, pin);
    saveToVault(slot, pinEncrypted);
  }

  // Delete the WebCrypto key — no longer needed
  await deleteVaultKey();
  setVaultTier('pin');
}

// ─── High-level: Read mnemonic (tier-aware) ──────────────────────────────────

export async function readMnemonicFromVault(slotId: VaultSlot, pin?: string): Promise<string | null> {
  const data = loadFromVault(slotId);
  if (!data) return null;

  const tier = getVaultTier();

  if (tier === 'pin') {
    if (!pin) throw new Error('PIN required to decrypt vault');
    return decryptWithPin(data, pin);
  }

  if (tier === 'upgrading') {
    // Crashed mid-upgrade — try PIN first (some slots may be upgraded), fall back to WebCrypto
    if (pin) {
      try {
        return await decryptWithPin(data, pin);
      } catch {
        // Fall through to WebCrypto
      }
    }
    const key = await loadKeyFromIDB();
    if (key) {
      try {
        return await decryptWithVaultKey(key, data);
      } catch {
        // Both tiers failed
      }
    }
    throw new Error('Vault is in an inconsistent state — cannot decrypt');
  }

  // WebCrypto tier
  const key = await loadKeyFromIDB();
  if (!key) throw new Error('WebCrypto key not found — vault is unrecoverable');
  return decryptWithVaultKey(key, data);
}

// ─── Hex encoding helpers ────────────────────────────────────────────────────

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
