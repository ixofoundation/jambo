import SecureStorage from 'secure-web-storage';
import CryptoJS from 'crypto-js';

// =================================================================================================
// LOCAL STORAGE
// =================================================================================================
const STORAGE = new Map<string, string>();

export function setStorage(key: string, value: string) {
  STORAGE.set(key, value);
}

export function getStorage(key: string) {
  return STORAGE.get(key);
}

export function removeStorage(key: string) {
  STORAGE.delete(key);
}

export function clearStorage() {
  STORAGE.clear();
}

// =================================================================================================
// SECURE STORAGE
// =================================================================================================
const SECRET_KEY = 'my secret key';

// Check if we're in a browser environment
const storage = typeof window !== 'undefined' ? window.localStorage : null;

const secureStorage = storage
  ? new SecureStorage(localStorage, {
      hash: function (key: string) {
        return CryptoJS.SHA256(key).toString();
      },
      encrypt: function (data: string) {
        return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
      },
      decrypt: function (data: string) {
        const bytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
      },
    })
  : null;

/**
 * Saves credentials that were already saved.
 * @param key The key to fetch.
 * @param value The value to store.
 * @returns The value that was saved.
 */
export function secureSave(key: string, value: string) {
  const valueStringified = JSON.stringify({ data: value });
  // @ts-ignore
  secureStorage.setItem(key, valueStringified);
  return value;
}

/**
 * Loads credentials that were already saved.
 * @param key The key to fetch.
 * @returns The value that was saved.
 */
export function secureLoad(key: string) {
  // @ts-ignore
  const valueStringified = secureStorage.getItem(key);
  const value = JSON.parse(valueStringified || '{}');
  return value.data;
}

/**
 * Resets any existing credentials for the given key.
 * @param key The key to reset.
 */
export function secureReset(key: string) {
  // @ts-ignore
  secureStorage.removeItem(key);
  return true;
}

/**
 * Resets all credentials saved.
 * @returns True if the operation was successful.
 */
export function secureResetAll() {
  // @ts-ignore
  secureStorage.clear();
  return true;
}
