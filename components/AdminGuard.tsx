import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import useIsAdmin from '@hooks/useIsAdmin';

/**
 * Route guard for admin-only screens. Assumes the user is already authenticated
 * (wrap inside AuthGuard). Confirms admin status against the jambo worker and
 * blocks rendering with an access-denied screen for non-admins.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GradientBand {...GRADIENT_COLORS.dashboard} />
        <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GradientBand {...GRADIENT_COLORS.dashboard} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px' }}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Access denied</h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
