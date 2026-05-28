import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { PiiIndexEntry, readAllPiiIndexEntries } from '@utils/matrixCredential';

interface LoadedPii {
  entry: PiiIndexEntry;
  pii: any;
}

export default function PiiDetailScreen() {
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
  const [data, setData] = useState<LoadedPii | null>(null);
  const [copied, setCopied] = useState(false);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      void router.push('/profile/pii');
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
        if (!cid) throw new Error('Missing credential data identifier');
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (!mxClient) throw new Error('Matrix client not ready');
        if (!roomId) throw new Error('User matrix room not available');

        const entries = readAllPiiIndexEntries(mxClient, roomId);
        const entry = entries.find((e) => e.cid === cid);
        if (!entry) throw new Error('Credential data not found in your Data Store');

        const room = mxClient.getRoom(roomId);
        if (!room) throw new Error('Matrix room not loaded');

        // Fast path: event already in the in-memory timeline (and likely decrypted).
        let event = room.findEventById(entry.eventId);

        // Fallback: fetch the raw event from the server (older than sync window).
        if (!event) {
          const raw = await mxClient.fetchRoomEvent(roomId, entry.eventId);
          const mapper = mxClient.getEventMapper();
          event = mapper(raw);
        }

        // Always attempt decryption — first pass may have failed before the megolm
        // key arrived from key backup.
        if (event.isEncrypted()) {
          await mxClient.decryptEventIfNeeded(event);
        }
        if (event.isDecryptionFailure()) {
          throw new Error('Credential data could not be decrypted on this device');
        }

        const content = event.getContent() as { pii?: string };
        if (!content?.pii) throw new Error('Credential data content is empty');

        let pii: any;
        try {
          pii = JSON.parse(content.pii);
        } catch {
          throw new Error('Stored credential data is not valid JSON');
        }

        if (!cancelled) setData({ entry, pii });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load credential data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, cid, awaitCompletion, getMatrixClient, roomId]);

  const prettyJson = useMemo(() => (data ? JSON.stringify(data.pii, null, 2) : ''), [data]);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Credential Data' onBack={goBack} />

      {/* Small green gradient band behind the (fixed) header so its onGradient styles apply. */}
      <div
        style={{
          background: 'radial-gradient(ellipse at top right, var(--green-secondary), var(--green-primary) 70%)',
          height: 'var(--header-height)',
        }}
      />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {loading && <Message>Loading credential data…</Message>}
        {error && !loading && <Message error>{error}</Message>}

        {!loading && !error && data && (
          <>
            {/* Header strip: shortened CID + stored date */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 16,
                border: '1px solid var(--border-color)',
                padding: '14px 16px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  opacity: 0.7,
                  fontFamily: 'var(--font-mono, monospace)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {shortenCid(data.entry.cid)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {formatStoredDate(data.entry.storedAt)}
              </span>
            </div>

            {/* JSON box with floating copy icon */}
            <div style={{ position: 'relative' }}>
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  paddingRight: 48,
                  borderRadius: 16,
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
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
                  borderRadius: 8,
                  background: 'var(--card-bg-color)',
                  color: copied ? 'var(--accent-color, #3b82f6)' : 'var(--text-secondary)',
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
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 16,
        border: '1px solid var(--border-color)',
        padding: '32px 16px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: error ? 'var(--error-color)' : 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
