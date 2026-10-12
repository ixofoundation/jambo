// matrix-js-sdk ≥ 41 types global account data: `getAccountData`/`setAccountData` only
// accept keys of `AccountDataEvents`. Register the custom event types this app stores
// so the typed API accepts them (see `cons.IN_IXO_YOMA_PREFERENCES` in constants/matrix.ts).
import 'matrix-js-sdk/lib/@types/event';

declare module 'matrix-js-sdk/lib/@types/event' {
  interface AccountDataEvents {
    'in.ixo.yoma.preferences': Record<string, unknown>;
  }
}
