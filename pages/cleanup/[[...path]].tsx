import Link from 'next/link';

import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

/**
 * What /cleanup shows when the youth app is not wired in.
 *
 * On a deployment where CLEANUP_APP_ORIGIN is set, next.config.js proxies
 * /cleanup and everything below it to the youth app BEFORE any page is
 * considered, so this page never renders there. Where the variable is blank
 * — production, until the campaign is on mainnet — every /cleanup address
 * lands here instead of a 404, and the cleanup deed's door says "soon"
 * rather than opening onto nothing.
 */
export default function CleanupComingSoonPage() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: 20, display: 'flex', justifyContent: 'center' }}>
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, marginTop: 'calc(30vh - 50px)' }}>
        <div className='card card--inset center' style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div aria-hidden style={{ fontSize: 44, lineHeight: 1 }}>
            🧹
          </div>
          <h2 style={{ color: 'var(--text-primary)', margin: '16px 0 8px' }}>World Cleanup Day</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, margin: '0 0 24px' }}>
            Coming soon. Mapping and cleaning open here once the campaign goes live.
          </p>
          <Link href='/'>
            <a className='btn btn--primary btn--block'>Back to the deck</a>
          </Link>
        </div>
      </div>
    </div>
  );
}
