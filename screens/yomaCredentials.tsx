import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

// TODO: Yoma credentials API integration pending — needs auth mechanism compatible with ixo auth hub

export default function YomaCredentialsScreen() {
  const router = useRouter();

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
