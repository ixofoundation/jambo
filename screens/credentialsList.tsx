import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { EventTimeline, RoomStateEvent } from 'matrix-js-sdk';

import Header from '@components/Header/Header';
import { ChevronRightIcon, ShieldCheckIcon } from '@components/Icons/icons';
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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Credentials' onBack={goBack} />

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
        {loading && <ListMessage>Loading credentials…</ListMessage>}
        {error && !loading && <ListMessage error>{error}</ListMessage>}
        {!loading && !error && sorted.length === 0 && <ListMessage>No credentials stored yet.</ListMessage>}

        {!loading && !error && sorted.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map((c) => (
              <button
                key={c.cid}
                className='cred-card'
                onClick={() => router.push(`/profile/credentials/${encodeURIComponent(c.cid)}`)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'var(--surface)',
                  border: 'none',
                  width: '100%',
                  color: 'var(--text-primary)',
                }}
              >
                <span className='cred-icon' style={{ background: 'var(--mint)', color: 'var(--green-primary)' }}>
                  <ShieldCheckIcon size={22} />
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-display)',
                      fontSize: '16.5px',
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
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
                    className='muted'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortenCid(c.cid)}</span>
                    <span aria-hidden>·</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortenCid(c.eventId)}</span>
                  </div>
                  <span className='muted' style={{ fontSize: 12.5 }}>
                    Stored at {formatDate(c.storedAt)}
                  </span>
                </div>
                <ChevronRightIcon size={18} color='var(--text-secondary)' />
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
    <div className='card card--inset center' style={{ padding: '32px 16px' }}>
      <p className={error ? undefined : 'muted'} style={{ color: error ? 'var(--error-color)' : undefined, fontSize: 14, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
