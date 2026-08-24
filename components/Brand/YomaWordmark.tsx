import { FC } from 'react';

/**
 * "yoma" wordmark: ink letters, the first 'o' is a coral ring with a yellow
 * dot resting on top — the Yoma Impacts Exchange brand mark (from the
 * designer's prototype). Brand colors are fixed, letters follow the theme ink.
 */
export const YomaWordmark: FC<{ height?: number }> = ({ height = 24 }) => {
  const s = height / 44;
  return (
    <svg width={150 * s} height={44 * s} viewBox='0 0 150 44' fill='none' aria-label='Yoma'>
      <text x='-2' y='36' fontFamily='var(--font-display)' fontSize='46' fontWeight='800' fill='var(--text-primary)' letterSpacing='-2'>
        y
      </text>
      <circle cx='47' cy='24' r='13' stroke='#F4552E' strokeWidth='7.5' fill='none' />
      <circle cx='53' cy='9.5' r='6.5' fill='#FFD23F' />
      <text x='63' y='36' fontFamily='var(--font-display)' fontSize='46' fontWeight='800' fill='var(--text-primary)' letterSpacing='-2'>
        ma
      </text>
    </svg>
  );
};

/** Stacked logo with the IMPACTS EXCHANGE tagline — welcome/auth screens. */
export const YomaLogo: FC<{ height?: number; tagline?: boolean }> = ({ height = 40, tagline = true }) => {
  const s = height / 40;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 5 * s }}>
      <svg width={150 * s} height={44 * s} viewBox='0 0 150 44' fill='none' aria-label='Yoma'>
        <text x='-2' y='36' fontFamily='var(--font-display)' fontSize='46' fontWeight='800' fill='#41204b' letterSpacing='-2'>
          y
        </text>
        <circle cx='47' cy='24' r='13' stroke='#F4552E' strokeWidth='7.5' fill='none' />
        <circle cx='53' cy='9.5' r='6.5' fill='#FFD23F' />
        <text x='63' y='36' fontFamily='var(--font-display)' fontSize='46' fontWeight='800' fill='#41204b' letterSpacing='-2'>
          ma
        </text>
      </svg>
      {tagline && (
        <span style={{ fontSize: 11.5 * s, letterSpacing: 3.5 * s, fontWeight: 700, color: '#41204b' }}>
          IMPACTS EXCHANGE
        </span>
      )}
    </div>
  );
};

export default YomaWordmark;
