import { findKycLevel1IndexEntry, loadKycLevel1Credential, loadKycPii } from '@utils/approvePayment';

// Reuse the matrix client type the credential loaders already expect, rather
// than re-importing it from matrix-js-sdk (whose named type export doesn't
// resolve cleanly in this project).
type MxClient = Parameters<typeof loadKycLevel1Credential>[0];

/**
 * Whether the user holds a KYCAMLLevel1 credential in their matrix store. This
 * reads the unencrypted credential index (no decryption needed), so it's a
 * reliable "do they have KYC" gate even when the credential body can't be
 * decrypted on this device.
 */
export function hasKycCredential(mxClient: MxClient, roomId: string): boolean {
  return !!findKycLevel1IndexEntry(mxClient, roomId);
}

/**
 * Best-effort auto-fill for the off-ramp KYC form from the user's stored identity.
 *
 * Design: each SOURCE declares its own `fields` map — exactly which keys (or a
 * custom extractor) yield each form field FROM THAT SOURCE. Sources are listed
 * in priority order; every field independently waterfalls down them — the first
 * source that yields a value wins. Adding a new source later is one `KYC_SOURCES`
 * entry with its own `fields` map; nothing else changes.
 *
 * Output normalization (date/country/id-type/phone formats) is global per field
 * — it's about the form's expected shape, not the source — and applied after a
 * source's raw value is extracted.
 *
 * Current sources, both already saved in the user's encrypted matrix room:
 *  - the KYCAMLLevel1 verifiable credential — authoritative identity (name, DOB,
 *    nationality, document type). Claims are an SD-JWT-style map `{ key: { value } }`.
 *  - the raw KYC PII blob — flat form data with fields the credential omits /
 *    selectively discloses (document number, email, …).
 *
 * Any field we resolve is treated as verified and locked in the form; anything
 * we can't resolve is left for the user to fill in.
 */
export interface KycPrefill {
  /** Full legal name (given + family). */
  name?: string;
  /** YYYY-MM-DD (the <input type="date"> format). */
  dob?: string;
  /** Sender nationality, ISO alpha-2. */
  country?: string;
  /** Mapped to the form's options: passport | national_id | drivers_license. */
  idType?: string;
  /** Identity document number. */
  idNumber?: string;
  email?: string;
  /** Digits only, no leading '+'. */
  phone?: string;
}

type FieldKey = keyof KycPrefill;

/** How a source yields one field: a list of candidate keys, or a custom reader. */
type Extractor = string[] | ((record: Record<string, any>) => unknown);

export interface KycSource {
  name: string;
  /** Return the source's raw record, or null when absent / unreadable. Must be
   *  best-effort: never throw (a missing source must not block the others). */
  load: (mxClient: MxClient, roomId: string) => Promise<Record<string, any> | null>;
  /** Per-source field mapping. Omit a field this source doesn't carry. */
  fields: Partial<Record<FieldKey, Extractor>>;
}

const ok = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Read a field from one source — a credential's `claims` map ({ value }) or a
 *  flat object — trying each candidate key, also as camelCase. */
function readKeys(source: Record<string, any>, keys: string[]): unknown {
  for (const key of keys) {
    const nested = source.claims?.[key];
    if (nested && typeof nested === 'object' && 'value' in nested) {
      if (ok(nested.value)) return nested.value;
    } else if (ok(nested)) {
      return nested;
    }
    if (ok(source[key])) return source[key];
    const camel = snakeToCamel(key);
    if (ok(source[camel])) return source[camel];
  }
  return undefined;
}

function extract(source: Record<string, any>, def: Extractor): unknown {
  return typeof def === 'function' ? def(source) : readKeys(source, def);
}

/** Compose a full name from given + family (each tried across `keys`), falling
 *  back to a single full-name field. Used as a custom extractor per source. */
function composeName(givenKeys: string[], familyKeys: string[], fullKeys: string[] = []) {
  return (record: Record<string, any>): string | undefined => {
    const given = readKeys(record, givenKeys);
    const family = readKeys(record, familyKeys);
    const composed = [given, family].filter(ok).map(String).join(' ').trim();
    if (composed) return composed;
    return fullKeys.length ? (readKeys(record, fullKeys) as string | undefined) : undefined;
  };
}

// --- Output normalizers (global per field; applied after extraction) ---

const DOC_TYPE_MAP: Record<string, string> = {
  passport: 'passport',
  national_identity_card: 'national_id',
  national_id: 'national_id',
  national_identity_number: 'national_id',
  id_card: 'national_id',
  identity_card: 'national_id',
  drivers_license: 'drivers_license',
  driver_license: 'drivers_license',
  driving_license: 'drivers_license',
  driving_licence: 'drivers_license',
};

function mapIdType(raw: string): string | undefined {
  return DOC_TYPE_MAP[raw.toLowerCase().replace(/[\s-]+/g, '_')];
}

function normCountry(raw: string): string | undefined {
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : undefined;
}

function normDob(raw: string): string | undefined {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); // MM/DD/YYYY
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

function normPhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, '');
  return digits || undefined;
}

const NORMALIZERS: Partial<Record<FieldKey, (raw: string) => string | undefined>> = {
  dob: normDob,
  country: normCountry,
  idType: mapIdType,
  phone: normPhone,
};

const FIELD_ORDER: FieldKey[] = ['name', 'dob', 'country', 'idType', 'idNumber', 'email', 'phone'];

/**
 * Ordered by trust/priority — earlier sources win. Each source maps only the
 * fields it actually carries; to add a source, append an entry with its own
 * `fields` map.
 */
export const KYC_SOURCES: KycSource[] = [
  {
    name: 'kycaml-credential',
    load: async (c, r) => {
      try {
        return (await loadKycLevel1Credential(c, r))?.credential ?? null;
      } catch {
        return null;
      }
    },
    // SD-JWT credential — claim names. It omits the document number / email / phone.
    fields: {
      name: composeName(['given_name'], ['family_name']),
      dob: ['birth_date'],
      country: ['nationality', 'birth_country'],
      idType: ['document_type'],
    },
  },
  {
    name: 'kyc-pii',
    load: async (c, r) => {
      try {
        return (await loadKycPii(c, r))?.pii ?? null;
      } catch {
        return null;
      }
    },
    // Flat PII blob — camelCase + a few snake_case keys. NB: `identifier` (no
    // suffix) is the street number here, NOT an ID — only `identifier_1` is the
    // identity-document number.
    fields: {
      name: composeName(['givenName', 'given_name', 'first_name'], ['familyName', 'family_name', 'last_name', 'surname'], ['name', 'full_name']),
      dob: ['birthDate', 'birth_date', 'date_of_birth', 'dob'],
      country: ['nationality', 'country', 'birth_country'],
      idType: ['document_type', 'id_type'],
      idNumber: ['identifier_1', 'document_number', 'id_number', 'identity_number', 'national_id_number'],
      email: ['email', 'email_address'],
      phone: ['phone_number', 'phone', 'telephone', 'mobile', 'mobile_number', 'msisdn', 'contact_number'],
    },
  },
];

export async function loadKycPrefill(mxClient: MxClient, roomId: string): Promise<KycPrefill> {
  // Load every source in priority order (best-effort; failures become null).
  const records = await Promise.all(
    KYC_SOURCES.map(async (src) => ({ src, record: await src.load(mxClient, roomId).catch(() => null) })),
  );
  if (records.every((r) => !r.record)) return {};

  const out: KycPrefill = {};
  for (const field of FIELD_ORDER) {
    for (const { src, record } of records) {
      const def = record && src.fields[field];
      if (!def) continue;
      const raw = extract(record, def);
      if (!ok(raw)) continue;
      const normalize = NORMALIZERS[field];
      const value = normalize ? normalize(String(raw).trim()) : String(raw).trim();
      if (ok(value)) {
        out[field] = value;
        break; // first source with a usable value wins
      }
    }
  }
  return out;
}
