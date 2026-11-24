/**
 * Photos and videos picked with no connection. The file is kept in the outbox
 * (IndexedDB) and the survey answer gets a placeholder instead of an upload
 * reference:
 *
 *   { "jamboHeldFile": "<id>", "name": "photo.jpg", "type": "image/jpeg" }
 *
 * SurveyJS stores file answers as `[{ name, type, content }]`, where `content`
 * is normally the JSON upload reference (lib/vfs/claimMedia, lib/matrix/
 * matrixClaims). Before a claim is signed, every placeholder is uploaded and
 * replaced with a real reference (`replaceHeldRefs`). A claim is never signed
 * with a placeholder in it.
 */

import { FILES, askToKeepStorage, get, newId, put, remove } from './db';

/** Bigger files are not held: a phone may not have the room. They fail as before. */
export const MAX_HELD_BYTES = 100 * 1024 * 1024;

export type HeldFileRecord = {
  id: string;
  address: string;
  collectionId: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: number;
};

type HeldRef = { jamboHeldFile: string; name: string; type: string };

/** The held-file id in a survey file `content`, or null if it is a normal upload. */
export function parseHeldRef(content: unknown): string | null {
  if (typeof content !== 'string' || !content.includes('jamboHeldFile')) return null;
  try {
    const parsed = JSON.parse(content) as Partial<HeldRef>;
    return typeof parsed.jamboHeldFile === 'string' ? parsed.jamboHeldFile : null;
  } catch {
    return null;
  }
}

/** Every held-file id anywhere in the survey answers (file answers can sit inside panels). */
export function findHeldFileIds(data: unknown): string[] {
  const ids: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const id = parseHeldRef((value as { content?: unknown }).content);
      if (id) ids.push(id);
      Object.values(value).forEach(walk);
    }
  };
  walk(data);
  return Array.from(new Set(ids));
}

/** A copy of the answers with each placeholder swapped for its uploaded reference. */
export function replaceHeldRefs<T>(data: T, uploaded: Record<string, string>): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) out[key] = walk(inner);
      const id = parseHeldRef(out.content);
      if (id) {
        if (!(id in uploaded)) throw new Error('A photo waiting to upload is missing its upload');
        out.content = uploaded[id];
      }
      return out;
    }
    return value;
  };
  return walk(data) as T;
}

/**
 * True when an error means "no connection", not "the server said no". Only
 * those are worth holding the file for; a refusal would fail again later.
 */
export function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true; // fetch() rejects with TypeError when it can't connect
  const message = err instanceof Error ? err.message : String(err ?? '');
  // `\bload failed` is Safari's fetch error; the \b keeps "Upload failed: 413" (a refusal) out.
  return /failed to fetch|networkerror|network request failed|\bload failed|err_internet_disconnected|timed? ?out/i.test(
    message,
  );
}

/** Keep a file on the phone; returns the SurveyJS answer content (the placeholder). */
export async function holdFile(file: File | Blob, address: string, collectionId: string): Promise<string> {
  if (file.size > MAX_HELD_BYTES) throw new Error('This file is too big to keep until you are back online');
  const record: HeldFileRecord = {
    id: newId(),
    address,
    collectionId,
    name: file instanceof File ? file.name : 'file',
    type: file.type || 'application/octet-stream',
    blob: file,
    createdAt: Date.now(),
  };
  await put(FILES, record);
  askToKeepStorage();
  const ref: HeldRef = { jamboHeldFile: record.id, name: record.name, type: record.type };
  return JSON.stringify(ref);
}

export async function loadHeldFile(id: string): Promise<HeldFileRecord | undefined> {
  return get<HeldFileRecord>(FILES, id);
}

export async function deleteHeldFile(id: string): Promise<void> {
  await remove(FILES, id);
}

/** A `data:` URL for the form's preview of a held file. */
export async function heldFilePreview(content: unknown): Promise<string | null> {
  const id = parseHeldRef(content);
  if (!id) return null;
  const record = await loadHeldFile(id);
  if (!record) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(record.blob);
  });
}
