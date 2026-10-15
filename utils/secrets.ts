import cons from '@constants/matrix';
import { secureLoad } from './storage';

function getSecret(key: string) {
  return secureLoad(key);
}

class Secrets {
  get accessToken() {
    return getSecret(cons.secretKey.ACCESS_TOKEN);
  }
  get deviceId() {
    return getSecret(cons.secretKey.DEVICE_ID);
  }
  get userId() {
    return getSecret(cons.secretKey.USER_ID);
  }
  get baseUrl() {
    return getSecret(cons.secretKey.BASE_URL);
  }
  /** Rust crypto store prefix of the saved device; unset for sessions saved before per-device names. */
  get cryptoDbPrefix(): string | undefined {
    return getSecret(cons.secretKey.CRYPTO_DB_PREFIX);
  }
}

const secret = new Secrets();

const isAuthenticated = () => !!secret.accessToken;

export { isAuthenticated, secret };
