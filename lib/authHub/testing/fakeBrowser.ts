/**
 * Test-only stand-ins for the browser globals the auth-hub modules use
 * (location, history, sessionStorage, localStorage), for vitest's node
 * environment. Not imported by app code.
 */
import { vi } from 'vitest';

export class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.has(key) ? (this.items.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
}

export interface FakeBrowser {
  window: {
    location: { href: string; origin: string; pathname: string; search: string; hash: string };
    history: { state: unknown; replaceState: ReturnType<typeof vi.fn> };
  };
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  /** Every replaceState / fetch, in order. */
  events: string[];
}

/** Install a fake browser at `href` on globalThis (undo with vi.unstubAllGlobals()). */
export function installFakeBrowser(href: string): FakeBrowser {
  const events: string[] = [];
  const location = { href: '', origin: '', pathname: '', search: '', hash: '' };
  const setHref = (next: string) => {
    const url = new URL(next, location.origin || undefined);
    location.href = url.href;
    location.origin = url.origin;
    location.pathname = url.pathname;
    location.search = url.search;
    location.hash = url.hash;
  };
  setHref(href);
  const history = {
    state: null as unknown,
    replaceState: vi.fn((state: unknown, _title: string, url?: string | null) => {
      history.state = state;
      if (url) setHref(url);
      events.push(`replaceState ${location.pathname}${location.search}`);
    }),
  };
  const fakeWindow = { location, history } as FakeBrowser['window'];
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('sessionStorage', sessionStorage);
  return { window: fakeWindow, localStorage, sessionStorage, events };
}
