import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { ShieldCheckIcon } from '@components/Icons/icons';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { ListedCredential, readAllCredentialIndexEntries } from '@utils/matrixCredential';

interface LoadedCredential {
  entry: ListedCredential;
  credential: any;
}

export default function CredentialDetailScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);

  const cidRaw = router.query.cid;
  const cid = useMemo(() => {
    if (Array.isArray(cidRaw)) return cidRaw[0] ?? '';
    return typeof cidRaw === 'string' ? cidRaw : '';
  }, [cidRaw]);

  const roomId = auth.matrixRoomId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadedCredential | null>(null);
  const [copied, setCopied] = useState(false);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      void router.push('/profile/credentials');
    }
  }, [router]);

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        if (!cid) throw new Error('Missing credential identifier');
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (!mxClient) throw new Error('Matrix client not ready');
        if (!roomId) throw new Error('User matrix room not available');

        const entries = readAllCredentialIndexEntries(mxClient, roomId);
        const entry = entries.find((e) => e.cid === cid);
        if (!entry) throw new Error('Credential not found in your data store');

        const room = mxClient.getRoom(roomId);
        if (!room) throw new Error('Matrix room not loaded');

        // Fast path: event is already in the in-memory timeline (and likely decrypted).
        let event = room.findEventById(entry.eventId);

        // Fallback: fetch the raw event from the server. Needed when the event is
        // older than the active sync window — `findEventById` only checks in-memory.
        if (!event) {
          const raw = await mxClient.fetchRoomEvent(roomId, entry.eventId);
          const mapper = mxClient.getEventMapper();
          event = mapper(raw);
        }

        // Always attempt decryption — even for events from the timeline, the first
        // pass may have failed before the megolm key arrived from key backup.
        if (event.isEncrypted()) {
          await mxClient.decryptEventIfNeeded(event);
        }
        if (event.isDecryptionFailure()) {
          throw new Error('Credential could not be decrypted on this device');
        }

        const content = event.getContent() as { credential?: string };
        if (!content?.credential) throw new Error('Credential content is empty');

        let credential: any;
        try {
          credential = JSON.parse(content.credential);
        } catch {
          throw new Error('Stored credential is not valid JSON');
        }

        if (!cancelled) setData({ entry, credential });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load credential');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, cid, awaitCompletion, getMatrixClient, roomId]);

  const prettyJson = useMemo(() => (data ? JSON.stringify(data.credential, null, 2) : ''), [data]);

  function handleCopy() {
    if (!prettyJson) return;
    navigator.clipboard
      .writeText(prettyJson)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title={data?.entry?.credentialKey || 'Credential'} onBack={goBack} />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {loading && <Message>Loading credential…</Message>}
        {error && !loading && <Message error>{error}</Message>}

        {!loading && !error && data && (
          <>
            {/* Credential pass hero: centred icon + title */}
            <div className='center' style={{ marginTop: 8, marginBottom: 20 }}>
              <span
                className='cred-icon'
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 20,
                  margin: '0 auto',
                  background: 'var(--mint)',
                  color: 'var(--green-primary)',
                }}
              >
                <ShieldCheckIcon size={34} />
              </span>
              <h1 className='h1' style={{ marginTop: 14, fontSize: 24, overflowWrap: 'anywhere' }}>
                {data.entry.credentialKey || 'Credential'}
              </h1>
            </div>

            {/* Credential details: shortened CID + stored date */}
            <div className='card card--inset' style={{ overflow: 'hidden', marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                }}
              >
                <span className='muted' style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                  ID
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortenCid(data.entry.cid)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <span className='muted' style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                  Stored
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {formatStoredDate(data.entry.storedAt)}
                </span>
              </div>
            </div>

            {/* JSON box with floating copy icon */}
            <div style={{ position: 'relative' }}>
              <pre
                className='card card--inset'
                style={{
                  margin: 0,
                  padding: 16,
                  paddingRight: 48,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  maxHeight: '70vh',
                }}
              >
                {prettyJson}
              </pre>
              <button
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy JSON'}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 10,
                  background: 'var(--surface-2)',
                  color: copied ? 'var(--green-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {copied ? (
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                ) : (
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                    <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function shortenCid(cid: string): string {
  if (!cid) return '';
  return cid.length > 15 ? `${cid.slice(0, 6)}...${cid.slice(-6)}` : cid;
}

function formatStoredDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function Message({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className='card card--inset center' style={{ padding: '32px 16px' }}>
      <p className={error ? undefined : 'muted'} style={{ color: error ? 'var(--error-color)' : undefined, fontSize: 14, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
