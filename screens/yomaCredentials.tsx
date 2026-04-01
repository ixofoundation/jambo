import { useRouter } from 'next/router';

import CollapsibleHeader from '@components/CollapsibleHeader/CollapsibleHeader';

// TODO: Yoma credentials API integration pending — needs auth mechanism compatible with ixo auth hub

export default function YomaCredentialsScreen() {
  const router = useRouter();

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <CollapsibleHeader variant='green' logo='/images/yoma-impacts-exchange-mono-logo.png' logoAlt='Yoma Impacts Exchange' title='Yoma Credentials' />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          paddingTop: 'calc(min(30vh, 300px) + 16px)',
          paddingBottom: 'calc(var(--footer-height) + 16px)',
          minHeight: 'calc(100vh + min(30vh, 300px) - var(--header-height))',
        }}
      >
        {/* Back nav */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => router.push('/profile')}
            aria-label='Go back to profile'
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-secondary)',
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
        </div>

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
            Yoma credentials integration coming soon.
          </p>
        </div>
      </main>
    </div>
  );
}
