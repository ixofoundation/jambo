import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAppSelector } from '@store/hooks';
import { loadWhitelistedEntities } from '@utils/projects';
import { ensureEntityProfiles } from '@utils/entityProfiles';
import Header from '@components/Header/Header';
import { ChevronRightIcon, LayersIcon } from '@components/Icons/icons';

function readableType(type?: string): string {
  if (!type) return '';
  const parts = type.split('/');
  const last = parts[parts.length - 1] || '';
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function ProjectList() {
  const router = useRouter();
  const projectIds = useAppSelector((state) => state.projects.ids);
  const profiles = useAppSelector((state) => state.profiles.byEntityDid);
  const [loading, setLoading] = useState(true);

  // Refresh the project list from the worker whitelist when the screen opens,
  // then pull profile documents (name, image) for anything missing.
  useEffect(() => {
    let cancelled = false;
    void loadWhitelistedEntities()
      .then((ids) => ensureEntityProfiles(ids))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <Header />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          minHeight: '100dvh',
        }}
      >
        <div className='section-header' style={{ marginTop: 4 }}>
          <h2>All opportunities</h2>
          <button className='section-arrow' aria-label='Open your deck' onClick={() => router.push('/')}>
            <LayersIcon size={16} />
          </button>
        </div>

        {projectIds.length === 0 ? (
          <div className='card card--inset center' style={{ padding: '32px 20px' }}>
            <p className='muted' style={{ margin: 0, fontSize: 14.5 }}>
              {loading ? 'Loading…' : 'No opportunities are live right now.'}
            </p>
          </div>
        ) : (
          projectIds.map((id) => {
            const profile = profiles[id];
            const thumb = profile?.image || profile?.logo;
            return (
              <button
                key={id}
                className='status-item'
                style={{ width: '100%', marginBottom: 12 }}
                onClick={() => router.push(`/entities/${encodeURIComponent(id)}`)}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} className='status-item__thumb' alt='' />
                ) : (
                  <span
                    className='status-item__thumb'
                    style={{ background: 'var(--purple-tint)', display: 'grid', placeItems: 'center', color: 'var(--purple-primary)' }}
                  >
                    <LayersIcon size={22} />
                  </span>
                )}
                <div className='status-item__body'>
                  <div className='status-item__title' style={{ fontSize: 15.5 }}>
                    {profile?.name || id}
                  </div>
                  {(profile?.brand || profile?.type) && (
                    <div className='status-item__meta'>
                      {[profile?.brand, readableType(profile?.type)].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <ChevronRightIcon size={18} color='var(--text-secondary)' />
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}
