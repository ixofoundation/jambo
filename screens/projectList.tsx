import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAppSelector } from '@store/hooks';
import { store } from '@store/index';
import { setProfile } from '@store/slices/profilesSlice';
import { fetchProtocolEntity } from '@utils/entity';
import { getServiceEndpoint, getAdditionalInfo } from '@utils/url';
import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

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
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Fetch profiles for any projects that don't have one yet
  useEffect(() => {
    const missingIds = projectIds.filter((id) => !profiles[id]);
    if (missingIds.length === 0) return;

    setLoadingProfiles(true);
    Promise.allSettled(
      missingIds.map(async (entityDid) => {
        try {
          const entity = await fetchProtocolEntity(entityDid);
          const profileEndpoint = entity?.settings?.Profile?.serviceEndpoint;
          if (!profileEndpoint) return;
          const resolvedUrl = getServiceEndpoint(profileEndpoint, entity.service);
          const profileData = await getAdditionalInfo(resolvedUrl);
          if (profileData?.name) {
            store.dispatch(
              setProfile({
                entityDid,
                profile: { name: profileData.name, logo: profileData.logo, type: entity.type },
              }),
            );
          }
        } catch {
          // Profile fetch failure is non-blocking
        }
      }),
    ).finally(() => setLoadingProfiles(false));
  }, [projectIds, profiles]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <GradientBand {...GRADIENT_COLORS.dashboard} />
      <Header onGradient />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 16px 16px',
          paddingTop: 'calc(var(--header-height) + 8px)',
          minHeight: '100vh',
        }}
      >
        {/* Page title section */}
        <div
          style={{
            minHeight: '150px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            Projects
          </h1>
        </div>

        {/* Project list */}
        {projectIds.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
              {loadingProfiles ? 'Loading...' : 'No projects found'}
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {projectIds.map((id, idx) => {
              const profile = profiles[id];
              return (
                <button
                  key={id}
                  onClick={() => router.push(`/entities/${encodeURIComponent(id)}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    width: '100%',
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: idx === projectIds.length - 1 ? 'none' : '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                      {profile?.name || id}
                    </p>
                    {profile?.type && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                        {readableType(profile.type)}
                      </span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-secondary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
