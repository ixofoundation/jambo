import { useRef, useEffect, FC } from 'react';
import HeaderStatusIndicator from '@components/HeaderStatusIndicator/HeaderStatusIndicator';
import styles from './CollapsibleHeader.module.scss';

type CollapsibleHeaderProps = {
  variant: 'purple' | 'blue' | 'green' | 'yellow';
  logo: string;
  logoAlt?: string;
  title?: string;
};

const COLLAPSED_HEIGHT = 60;
const LOGO_EXPANDED_WIDTH = 150;
const TITLE_AREA_HEIGHT = 44;
const TITLE_FONT_EXPANDED = 20;
const TITLE_FONT_COLLAPSED = 17;
const SNAP_DEBOUNCE_MS = 150;

const CollapsibleHeader: FC<CollapsibleHeaderProps> = ({ variant, logo, logoAlt = '', title }) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const logoEl = logoRef.current;
    const titleEl = titleRef.current;
    if (!header || !logoEl) return;

    let snapTimer: ReturnType<typeof setTimeout> | undefined;

    function getExpandedHeight() {
      return Math.min(window.innerHeight * 0.3, 300);
    }

    function applyStyles(progress: number) {
      if (!header || !logoEl) return;

      const expandedHeight = getExpandedHeight();
      const scrollRange = expandedHeight - COLLAPSED_HEIGHT;

      // Header height
      const currentHeight = expandedHeight - scrollRange * progress;
      header.style.height = `${currentHeight}px`;

      // Logo: centered, fades out by progress 0.7
      const logoProgress = Math.min(progress / 0.7, 1);
      const logoOpacity = Math.max(1 - logoProgress, 0);
      const logoWidth = LOGO_EXPANDED_WIDTH - 50 * logoProgress;

      const titleArea = title ? TITLE_AREA_HEIGHT * (1 - progress) : 0;
      const logoZoneHeight = currentHeight - titleArea;
      const logoCenterY = logoZoneHeight / 2;

      logoEl.style.opacity = `${logoOpacity}`;
      logoEl.style.width = `${logoWidth}px`;
      logoEl.style.top = `${logoCenterY}px`;
      logoEl.style.left = '50%';
      logoEl.style.transform = 'translate(-50%, -50%)';

      // Title: bottom-center → top-left
      if (titleEl) {
        const titleTopExpanded = expandedHeight - TITLE_AREA_HEIGHT / 2;
        const titleTopCollapsed = COLLAPSED_HEIGHT / 2;
        const titleTop = titleTopExpanded + (titleTopCollapsed - titleTopExpanded) * progress;

        const titleLeftPercent = 50 * (1 - progress);
        const titleLeftPx = 16 * progress;
        const titleTranslateX = -50 * (1 - progress);
        const titleFontSize = TITLE_FONT_EXPANDED + (TITLE_FONT_COLLAPSED - TITLE_FONT_EXPANDED) * progress;

        titleEl.style.top = `${titleTop}px`;
        titleEl.style.left = `calc(${titleLeftPercent}% + ${titleLeftPx}px)`;
        titleEl.style.transform = `translate(${titleTranslateX}%, -50%)`;
        titleEl.style.fontSize = `${titleFontSize}px`;
        titleEl.style.maxWidth = `calc(100% - ${32 + 40 * progress}px)`;
      }
    }

    function update() {
      const expandedHeight = getExpandedHeight();
      const scrollRange = expandedHeight - COLLAPSED_HEIGHT;
      const progress = Math.min(Math.max(window.scrollY / scrollRange, 0), 1);
      applyStyles(progress);

      // Snap to nearest state when user stops scrolling
      clearTimeout(snapTimer);
      if (progress > 0.02 && progress < 0.98) {
        snapTimer = setTimeout(() => {
          const target = progress < 0.5 ? 0 : scrollRange;
          window.scrollTo({ top: target, behavior: 'smooth' });
        }, SNAP_DEBOUNCE_MS);
      }
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      clearTimeout(snapTimer);
    };
  }, [title]);

  return (
    <div ref={headerRef} className={`${styles.header} ${styles[variant]}`}>
      <div className={styles.inner}>
        <div className={styles.controls}>
          <div className={styles.spacer} />
          <HeaderStatusIndicator />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={logoRef} src={logo} alt={logoAlt} className={styles.logo} />
        {title && (
          <span ref={titleRef} className={styles.title}>
            {title}
          </span>
        )}
      </div>
    </div>
  );
};

export default CollapsibleHeader;
