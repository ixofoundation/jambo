import { describe, expect, it } from 'vitest';

import { BURN_EXPIRY_MARGIN_MS } from './burn';
import {
  EMPTY_BOOK,
  MAX_FINISHED_SWAPS,
  canSignBurn,
  findSwap,
  isFinished,
  loadSwapBook,
  openSwap,
  saveSwapBook,
  storedBurnMessage,
  swapBookKey,
  swapFromResponse,
  swapNeed,
  withBroadcastBurn,
  withBurnNotMade,
  withServiceDetail,
  withSignedBurn,
  withSwap,
  withVouchers,
  type KeyValueStore,
  type StoredSwap,
} from './swapStore';
import { ADDRESS, NOW, PIN, REFERENCE, SWAP_ID, TX_HASH, burnOf, detailOf, responseOf } from './testFixtures';

function memStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const asked = (): StoredSwap => swapFromResponse(responseOf(), NOW);

describe('the swap book (localStorage, per account)', () => {
  it('round-trips per account', () => {
    const store = memStore();
    const book = withVouchers(withSwap(EMPTY_BOOK, asked()), 45, NOW);
    expect(saveSwapBook(store, ADDRESS, book)).toBe(true);
    expect(loadSwapBook(store, ADDRESS)).toEqual(book);
    expect(loadSwapBook(store, 'ixo1other')).toEqual(EMPTY_BOOK);
    expect(store.map.has(swapBookKey(ADDRESS))).toBe(true);
  });

  it('says so when storage does not take it, so no burn is signed', () => {
    expect(saveSwapBook(null, ADDRESS, EMPTY_BOOK)).toBe(false);
    const throwing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(saveSwapBook(throwing, ADDRESS, EMPTY_BOOK)).toBe(false);
    // Storage that silently drops the write.
    const dropping: KeyValueStore = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
    expect(saveSwapBook(dropping, ADDRESS, EMPTY_BOOK)).toBe(false);
  });

  it('drops malformed entries and survives broken storage', () => {
    const store = memStore();
    store.setItem(
      swapBookKey(ADDRESS),
      JSON.stringify({ v: 1, swaps: [asked(), { id: 'x' }, null, { ...asked(), id: 'b', status: 'paid' }] }),
    );
    expect(loadSwapBook(store, ADDRESS).swaps.map((s) => s.id)).toEqual([SWAP_ID]);
    store.setItem(swapBookKey(ADDRESS), '{not json');
    expect(loadSwapBook(store, ADDRESS)).toEqual(EMPTY_BOOK);
    store.setItem(swapBookKey(ADDRESS), JSON.stringify({ v: 2, swaps: [asked()] }));
    expect(loadSwapBook(store, ADDRESS)).toEqual(EMPTY_BOOK);
  });

  it('never stores the PIN', () => {
    const store = memStore();
    const fulfilled = withServiceDetail(asked(), detailOf({ status: 'fulfilled', burnTxHash: TX_HASH }, PIN), NOW);
    saveSwapBook(store, ADDRESS, withSwap(EMPTY_BOOK, fulfilled));
    const raw = store.map.get(swapBookKey(ADDRESS)) ?? '';
    expect(raw).not.toContain(PIN.pin);
    expect(raw).not.toContain('ussd');
    expect(Object.keys(fulfilled)).not.toContain('pin');
  });

  it('keeps every unfinished swap and the newest finished ones', () => {
    let book = EMPTY_BOOK;
    const unfinished: StoredSwap = { ...asked(), id: 'open', createdAt: 1, burn: 'signed', txHash: TX_HASH };
    book = withSwap(book, unfinished);
    for (let i = 0; i < MAX_FINISHED_SWAPS + 5; i += 1) {
      book = withSwap(book, { ...asked(), id: `done-${i}`, status: 'fulfilled', createdAt: 100 + i });
    }
    expect(book.swaps).toHaveLength(MAX_FINISHED_SWAPS + 1);
    expect(findSwap(book, 'open')).not.toBeNull();
    expect(findSwap(book, 'done-0')).toBeNull();
    expect(book.swaps[0].id).toBe(`done-${MAX_FINISHED_SWAPS + 4}`);
  });
});

describe('never burning twice', () => {
  it('a swap just asked for may be burned', () => {
    const swap = asked();
    expect(swap.tokens).toEqual(burnOf().value.tokens);
    expect(canSignBurn(swap, NOW)).toBe(true);
    expect(swapNeed(swap, NOW)).toBe('ready');
  });

  it('once a burn is signed, it is never signed again, whatever happens to the page', () => {
    const store = memStore();
    const signed = withSignedBurn(asked(), TX_HASH.toLowerCase(), NOW);
    expect(signed.txHash).toBe(TX_HASH);
    expect(canSignBurn(signed, NOW)).toBe(false);
    expect(() => withSignedBurn(signed, 'CD'.repeat(32), NOW)).toThrow();

    // The page closes right after signing; the next visit finds the hash and only redeems.
    saveSwapBook(store, ADDRESS, withSwap(EMPTY_BOOK, signed));
    const back = openSwap(loadSwapBook(store, ADDRESS), NOW + 60_000);
    expect(back?.txHash).toBe(TX_HASH);
    expect(back && swapNeed(back, NOW + 60_000)).toBe('burn_sent');
    expect(back && canSignBurn(back, NOW + 60_000)).toBe(false);

    const broadcast = withBroadcastBurn(signed, NOW);
    expect(broadcast.burn).toBe('broadcast');
    expect(canSignBurn(broadcast, NOW)).toBe(false);
  });

  it('only a burn that provably did not happen may be signed again', () => {
    const signed = withSignedBurn(asked(), TX_HASH, NOW);
    const notMade = withBurnNotMade(signed, NOW);
    expect(notMade.burn).toBe('none');
    expect(notMade.txHash).toBeNull();
    expect(canSignBurn(notMade, NOW)).toBe(true);
    // Not for a swap the service already took the burn of.
    const owed = withServiceDetail(signed, detailOf({ status: 'redeeming', burnTxHash: TX_HASH }), NOW);
    expect(withBurnNotMade(owed, NOW)).toBe(owed);
  });

  it('does not sign with too little time left, without the burn, or for a closed swap', () => {
    const swap = asked();
    const expiresAt = Date.parse(swap.expiresAt);
    expect(canSignBurn(swap, expiresAt - BURN_EXPIRY_MARGIN_MS)).toBe(true);
    expect(canSignBurn(swap, expiresAt - BURN_EXPIRY_MARGIN_MS + 1)).toBe(false);
    expect(canSignBurn({ ...swap, tokens: null }, NOW)).toBe(false);
    expect(canSignBurn({ ...swap, tokens: [] }, NOW)).toBe(false);
    for (const status of ['redeeming', 'fulfilled', 'expired', 'flagged'] as const) {
      expect(canSignBurn({ ...swap, status }, NOW)).toBe(false);
    }
  });

  it('a record that lost its hash but says a burn was signed stays unsignable', () => {
    const store = memStore();
    store.setItem(
      swapBookKey(ADDRESS),
      JSON.stringify({ v: 1, swaps: [{ ...asked(), burn: 'signed', txHash: 'zz' }] }),
    );
    const [swap] = loadSwapBook(store, ADDRESS).swaps;
    expect(swap.burn).toBe('signed');
    expect(swap.txHash).toBeNull();
    expect(canSignBurn(swap, NOW)).toBe(false);
  });

  it('a burn the service itself recorded settles it: nothing is signed', () => {
    // Asked on this device, burned from another (or the hash was lost): the service knows.
    const owed = withServiceDetail(asked(), detailOf({ status: 'redeeming', burnTxHash: TX_HASH.toLowerCase() }), NOW);
    expect(owed.burn).toBe('broadcast');
    expect(owed.txHash).toBe(TX_HASH);
    expect(canSignBurn(owed, NOW)).toBe(false);
    expect(swapNeed(owed, NOW)).toBe('owed');
  });
});

describe('where a stored swap stands', () => {
  it('follows the service’s status', () => {
    const signed = withSignedBurn(asked(), TX_HASH, NOW);
    expect(swapNeed(withServiceDetail(signed, detailOf({ status: 'fulfilled' }, PIN), NOW), NOW)).toBe('pin');
    expect(swapNeed(withServiceDetail(signed, detailOf({ status: 'flagged' }), NOW), NOW)).toBe('flagged');
    const owed = withServiceDetail(signed, detailOf({ status: 'redeeming' }, null, 'The PIN is being issued.'), NOW);
    expect(owed.message).toBe('The PIN is being issued.');
    expect(swapNeed(owed, NOW)).toBe('owed');
  });

  it('a swap that ran out with nothing signed is expired; with a burn sent it is still checked', () => {
    const swap = asked();
    const late = Date.parse(swap.expiresAt) + 1;
    expect(swapNeed(swap, late)).toBe('expired');
    expect(openSwap(withSwap(EMPTY_BOOK, swap), late)).toBeNull();
    expect(isFinished({ ...swap, status: 'expired' })).toBe(true);

    const sent = withServiceDetail(withSignedBurn(swap, TX_HASH, NOW), detailOf({ status: 'expired' }), late);
    expect(swapNeed(sent, late)).toBe('burn_sent');
    expect(isFinished(sent)).toBe(false);
    // It stays in the list to check again, but no longer takes over the screen.
    expect(openSwap(withSwap(EMPTY_BOOK, sent), late)).toBeNull();
  });

  it('a swap opened elsewhere cannot be burned for here', () => {
    const elsewhere = withServiceDetail(null, detailOf(), NOW);
    expect(elsewhere.tokens).toBeNull();
    expect(elsewhere.reference).toBe(REFERENCE);
    expect(swapNeed(elsewhere, NOW)).toBe('open_elsewhere');
    expect(canSignBurn(elsewhere, NOW)).toBe(false);
  });

  it('returns to the newest unfinished swap', () => {
    const done: StoredSwap = { ...asked(), id: 'done', status: 'fulfilled', createdAt: NOW + 10 };
    const open: StoredSwap = { ...withSignedBurn(asked(), TX_HASH, NOW), id: 'open', createdAt: NOW + 5 };
    const book = withSwap(withSwap(EMPTY_BOOK, open), done);
    expect(openSwap(book, NOW + 20)?.id).toBe('open');
  });

  it('rebuilds the burn of a stored swap in the service’s shape', () => {
    expect(storedBurnMessage(asked(), ADDRESS)).toEqual(burnOf());
  });
});
