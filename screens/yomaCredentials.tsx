import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import Loader from '@components/Loader/Loader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { searchYomaCredentials, getYomaCredential } from 'lib/sso/yomaApi';

interface CredentialAttribute {
  name: string;
  nameDisplay: string;
  valueDisplay: string;
}

interface CredentialSummary {
  id: string;
  schemaType: number;
  title: string;
  issuer: string;
  dateIssued: string;
  issuerLogoURL?: string;
}

interface CredentialDetail extends CredentialSummary {
  attributes: CredentialAttribute[];
}

type FetchState = 'loading' | 'error' | 'empty' | 'done';

const SCHEMA_LABELS: Record<number, string> = {
  0: 'Opportunity',
  1: 'YoID',
};

export default function YomaCredentialsScreen() {
  const router = useRouter();
  const [state, setState] = useState<FetchState>('loading');
  const [credentials, setCredentials] = useState<CredentialDetail[]>([]);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCredentials() {
      try {
        const searchResult = await searchYomaCredentials({ pageNumber: 1, pageSize: 50 });
        const items: CredentialSummary[] = searchResult?.items ?? [];

        if (cancelled) return;

        if (items.length === 0) {
          setState('empty');
          return;
        }

        const details = await Promise.all(
          items.map(async (item: CredentialSummary) => {
            try {
              const detail = await getYomaCredential(item.id);
              return { ...item, ...detail } as CredentialDetail;
            } catch {
              return { ...item, attributes: [] } as CredentialDetail;
            }
          }),
        );

        if (cancelled) return;
        setCredentials(details);
        setState('done');
      } catch (err: any) {
        if (cancelled) return;
        console.error('[Yoma Credentials] Fetch error:', err);
        setError(err.message || 'Failed to load credentials');
        setState('error');
      }
    }

    fetchCredentials();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <GradientBand {...GRADIENT_COLORS.profile} />
      <Header onGradient />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          paddingTop: 'calc(var(--header-height) + 20px)',
        }}
      >
        {/* Back breadcrumb */}
        <button
          onClick={() => router.push('/profile')}
          aria-label='Go back to profile'
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            margin: '0 0 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 400,
            lineHeight: 1.2,
          }}
        >
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <polyline points='15 18 9 12 15 6' />
          </svg>
          Profile
        </button>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 20px',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Yoma Credentials
        </h2>

        {/* Loading */}
        {state === 'loading' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '48px 0',
            }}
          >
            {/* @ts-ignore */}
            <Loader size={40} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading credentials...</p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '24px 16px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--error-color, red)', fontSize: '14px', margin: '0 0 16px' }}>{error}</p>
            <button
              onClick={() => {
                setState('loading');
                setError('');
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--card-bg-color)',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {state === 'empty' && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              No credentials found for your Yoma account.
            </p>
          </div>
        )}

        {/* Credentials list */}
        {state === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {credentials.map((cred) => {
              const isExpanded = expandedId === cred.id;
              const schemaLabel = SCHEMA_LABELS[cred.schemaType] ?? `Type ${cred.schemaType}`;
              const dateStr = cred.dateIssued
                ? new Date(cred.dateIssued).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : null;

              return (
                <div
                  key={cred.id}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Card header — clickable to expand */}
                  <button
                    onClick={() => toggleExpand(cred.id)}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    {/* Issuer logo or fallback */}
                    {cred.issuerLogoURL ? (
                      <img
                        src={cred.issuerLogoURL}
                        alt=''
                        style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: cred.schemaType === 1 ? 'var(--accent-color)' : 'var(--blue-primary, #3b82f6)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {cred.title?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cred.title || 'Credential'}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: cred.schemaType === 1 ? 'var(--accent-color)' : 'var(--blue-primary, #3b82f6)',
                            color: 'white',
                            flexShrink: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {schemaLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>{cred.issuer}</span>
                        {dateStr && (
                          <>
                            <span style={{ opacity: 0.4 }}>|</span>
                            <span>{dateStr}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='var(--text-secondary)'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      style={{
                        flexShrink: 0,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <polyline points='6 9 12 15 18 9' />
                    </svg>
                  </button>

                  {/* Expanded attributes */}
                  {isExpanded && cred.attributes.length > 0 && (
                    <div
                      style={{
                        borderTop: '1px solid var(--border-color)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {cred.attributes.map((attr, i) => (
                        <div key={`${attr.name}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px',
                            }}
                          >
                            {attr.nameDisplay || attr.name}
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              wordBreak: 'break-word',
                              lineHeight: 1.4,
                            }}
                          >
                            {attr.valueDisplay || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && cred.attributes.length === 0 && (
                    <div
                      style={{
                        borderTop: '1px solid var(--border-color)',
                        padding: '16px',
                      }}
                    >
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                        No attributes available for this credential.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
