import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { EventTimeline, RoomStateEvent } from 'matrix-js-sdk';

import Header from '@components/Header/Header';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { ListedCredential, readAllCredentialIndexEntries } from '@utils/matrixCredential';

function shortenCid(cid: string): string {
  if (!cid) return '';
  return cid.length > 15 ? `${cid.slice(0, 6)}...${cid.slice(-6)}` : cid;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function CredentialsListScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ListedCredential[]>([]);

  const roomId = auth.matrixRoomId;

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      void router.push('/profile');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (!mxClient) throw new Error('Matrix client not ready');
        if (!roomId) throw new Error('User matrix room not available');

        const refresh = () => {
          if (cancelled) return;
          setCredentials(readAllCredentialIndexEntries(mxClient, roomId));
        };

        refresh();

        // Live-refresh the list when a new ixo.credential.index state event lands
        // (covers the "just saved a credential, navigated here, but sync hadn't
        // delivered the state event yet" case).
        const room = mxClient.getRoom(roomId);
        const liveState = room?.getLiveTimeline().getState(EventTimeline.FORWARDS);
        if (liveState) {
          const handler = (event: any) => {
            if (event?.getType?.() === 'ixo.credential.index') refresh();
          };
          liveState.on(RoomStateEvent.Events, handler);
          detach = () => liveState.off(RoomStateEvent.Events, handler);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load credentials');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (detach) detach();
    };
  }, [awaitCompletion, getMatrixClient, roomId]);

  const sorted = useMemo(
    () => [...credentials].sort((a, b) => (b.storedAt || '').localeCompare(a.storedAt || '')),
    [credentials],
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Credentials' onBack={goBack} />

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
        {loading && <ListMessage>Loading credentials…</ListMessage>}
        {error && !loading && <ListMessage error>{error}</ListMessage>}
        {!loading && !error && sorted.length === 0 && <ListMessage>No credentials stored yet.</ListMessage>}

        {!loading && !error && sorted.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {sorted.map((c, idx) => (
              <button
                key={c.cid}
                onClick={() => router.push(`/profile/credentials/${encodeURIComponent(c.cid)}`)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: idx === sorted.length - 1 ? 'none' : '1px solid var(--border-color)',
                  width: '100%',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {c.credentialKey || 'Credential'}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      opacity: 0.7,
                      fontFamily: 'var(--font-mono, monospace)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortenCid(c.cid)}</span>
                    <span aria-hidden>·</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortenCid(c.eventId)}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Stored at {formatDate(c.storedAt)}
                  </span>
                </div>
                <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='var(--text-secondary)'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <polyline points='9 18 15 12 9 6' />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ListMessage({ children, error }: { children: React.ReactNode; error?: boolean }) {
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
