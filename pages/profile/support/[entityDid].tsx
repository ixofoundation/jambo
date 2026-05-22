import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import GradientBand from '@components/GradientBand/GradientBand';
import Header from '@components/Header/Header';
import SupportErrorView from '@components/Support/views/SupportErrorView';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import SupportScreen from 'screens/support';

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function SupportPage() {
  const router = useRouter();
  const entityDid = pickString(router.query.entityDid);
  const promptsKey = pickString(router.query.prompts);

  if (!router.isReady) {
    return null;
  }

  if (!entityDid) {
    return (
      <AuthGuard>
        <div style={{ position: 'relative', minHeight: '100vh' }}>
          <GradientBand {...GRADIENT_COLORS.profile} />
          <Header onGradient title='Support' onBack={() => router.push('/profile')} />
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
            <SupportErrorView
              message='Support room not specified.'
              onClose={() => router.push('/profile')}
            />
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <SupportScreen entityDid={entityDid} promptsKey={promptsKey} />
    </AuthGuard>
  );
}
