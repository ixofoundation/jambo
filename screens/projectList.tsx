import { useEffect, useState } from 'react';

import { useAppSelector } from '@store/hooks';
import { store } from '@store/index';
import { setProfile } from '@store/slices/profilesSlice';
import { fetchProtocolEntity } from '@utils/entity';
import { getServiceEndpoint, getAdditionalInfo } from '@utils/url';
import CollapsibleHeader from '@components/CollapsibleHeader/CollapsibleHeader';
import ProjectSection from '@components/ProjectSection/ProjectSection';

export default function ProjectList() {
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <CollapsibleHeader
        variant='purple'
        logo='/images/yoma-impacts-exchange-mono-logo.png'
        logoAlt='Yoma Impacts Exchange'
        title='Explore'
      />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 16px 16px',
          paddingTop: 'calc(min(30vh, 300px) + 16px)',
          paddingBottom: 'calc(var(--footer-height) + 16px)',
          minHeight: 'calc(100vh + min(30vh, 300px) - var(--header-height))',
        }}
      >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {projectIds
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .concat(projectIds)
              .map((id, i) => (
                <ProjectSection key={`${id}-${i}`} entityDid={id} />
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
