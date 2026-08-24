import { FC, ReactNode } from 'react';

/**
 * Shared stroke-icon set (Lucide path data, ISC) — one consistent 2px stroke
 * system for the redesigned surfaces, replacing the ad-hoc inline SVGs.
 */

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

const Icon: FC<IconProps & { children: ReactNode }> = ({ size = 24, color = 'currentColor', strokeWidth = 2, style, children }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    style={style}
    aria-hidden='true'
  >
    {children}
  </svg>
);

export const LayersIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z' />
    <path d='M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' />
    <path d='M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' />
  </Icon>
);

export const HandshakeIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m11 17 2 2a1 1 0 1 0 3-3' />
    <path d='m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4' />
    <path d='m21 3 1 11h-2' />
    <path d='M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3' />
    <path d='M3 4h8' />
  </Icon>
);

export const WalletIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M17 14h.01' />
    <path d='M7 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14' />
  </Icon>
);

export const UserRoundIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx='12' cy='8' r='5' />
    <path d='M20 21a8 8 0 0 0-16 0' />
  </Icon>
);

export const UserRoundPlusIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M2 21a8 8 0 0 1 13.292-6' />
    <circle cx='10' cy='8' r='5' />
    <path d='M19 16v6' />
    <path d='M22 19h-6' />
  </Icon>
);

export const ChevronUpIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m18 15-6-6-6 6' />
  </Icon>
);

export const ChevronRightIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m9 18 6-6-6-6' />
  </Icon>
);

export const ChevronDownIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m6 9 6 6 6-6' />
  </Icon>
);

export const XIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M18 6 6 18' />
    <path d='m6 6 12 12' />
  </Icon>
);

export const ArrowLeftIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m12 19-7-7 7-7' />
    <path d='M19 12H5' />
  </Icon>
);

export const ArrowRightIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M5 12h14' />
    <path d='m12 5 7 7-7 7' />
  </Icon>
);

export const ArrowUpIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m5 12 7-7 7 7' />
    <path d='M12 19V5' />
  </Icon>
);

export const CheckIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M20 6 9 17l-5-5' />
  </Icon>
);

export const BookmarkIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' />
  </Icon>
);

export const BadgeCheckIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z' />
    <path d='m9 12 2 2 4-4' />
  </Icon>
);

export const ClockIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='10' />
    <polyline points='12 6 12 12 16.5 12' />
  </Icon>
);

export const HourglassIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M5 22h14' />
    <path d='M5 2h14' />
    <path d='M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22' />
    <path d='M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2' />
  </Icon>
);

export const MapPinIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' />
    <circle cx='12' cy='10' r='3' />
  </Icon>
);

export const SparklesIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z' />
    <path d='M20 3v4' />
    <path d='M22 5h-4' />
  </Icon>
);

export const RotateCcwIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' />
    <path d='M3 3v5h5' />
  </Icon>
);

export const BanknoteIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect width='20' height='12' x='2' y='6' rx='2' />
    <circle cx='12' cy='12' r='2' />
    <path d='M6 12h.01M18 12h.01' />
  </Icon>
);

export const LandmarkIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <line x1='3' x2='21' y1='22' y2='22' />
    <line x1='6' x2='6' y1='18' y2='11' />
    <line x1='10' x2='10' y1='18' y2='11' />
    <line x1='14' x2='14' y1='18' y2='11' />
    <line x1='18' x2='18' y1='18' y2='11' />
    <polygon points='12 2 20 7 4 7' />
  </Icon>
);

export const AwardIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526' />
    <circle cx='12' cy='8' r='6' />
  </Icon>
);

export const CalendarDaysIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M8 2v4' />
    <path d='M16 2v4' />
    <rect width='18' height='18' x='3' y='4' rx='2' />
    <path d='M3 10h18' />
    <path d='M8 14h.01' />
    <path d='M12 14h.01' />
    <path d='M16 14h.01' />
    <path d='M8 18h.01' />
    <path d='M12 18h.01' />
    <path d='M16 18h.01' />
  </Icon>
);

export const ShieldCheckIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
    <path d='m9 12 2 2 4-4' />
  </Icon>
);

export const FileCheckIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4' />
    <path d='M14 2v4a2 2 0 0 0 2 2h4' />
    <path d='m3 15 2 2 4-4' />
  </Icon>
);

export const MessageCircleIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M7.9 20A9 9 0 1 0 4 16.1L2 22Z' />
  </Icon>
);

export const CopyIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
    <path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
  </Icon>
);

export const LogOutIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
    <polyline points='16 17 21 12 16 7' />
    <line x1='21' x2='9' y1='12' y2='12' />
  </Icon>
);

export const SettingsIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='3' />
    <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
  </Icon>
);

export const CreditCardIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect width='20' height='14' x='2' y='5' rx='2' />
    <line x1='2' x2='22' y1='10' y2='10' />
  </Icon>
);

export const ArrowUpRightIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M7 7h10v10' />
    <path d='M7 17 17 7' />
  </Icon>
);

export const ArrowDownLeftIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M17 7 7 17' />
    <path d='M17 17H7V7' />
  </Icon>
);

export const LifeBuoyIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='10' />
    <path d='m4.93 4.93 4.24 4.24' />
    <path d='m14.83 9.17 4.24-4.24' />
    <path d='m14.83 14.83 4.24 4.24' />
    <path d='m9.17 14.83-4.24 4.24' />
    <circle cx='12' cy='12' r='4' />
  </Icon>
);

export const KeyRoundIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z' />
    <circle cx='16.5' cy='7.5' r='.5' fill='currentColor' />
  </Icon>
);

export const LogInIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' />
    <polyline points='10 17 15 12 10 7' />
    <line x1='15' x2='3' y1='12' y2='12' />
  </Icon>
);

export const FingerprintIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4' />
    <path d='M14 13.12c0 2.38 0 6.38-1 8.88' />
    <path d='M17.29 21.02c.12-.6.43-2.3.5-3.02' />
    <path d='M2 12a10 10 0 0 1 18-6' />
    <path d='M2 16h.01' />
    <path d='M21.8 16c.2-2 .131-5.354 0-6' />
    <path d='M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2' />
    <path d='M8.65 22c.21-.66.45-1.32.57-2' />
    <path d='M9 6.8a6 6 0 0 1 9 5.2v2' />
  </Icon>
);

export const BellIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M10.268 21a2 2 0 0 0 3.464 0' />
    <path d='M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326' />
  </Icon>
);

export const CircleIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='10' />
  </Icon>
);

export const MoreHorizontalIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='1' />
    <circle cx='19' cy='12' r='1' />
    <circle cx='5' cy='12' r='1' />
  </Icon>
);

export const ShareIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d='M12 2v13' />
    <path d='m16 6-4-4-4 4' />
    <path d='M8.5 10H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2.5' />
  </Icon>
);

export const SlidersIcon: FC<IconProps> = (p) => (
  <Icon {...p}>
    <line x1='21' x2='14' y1='4' y2='4' />
    <line x1='10' x2='3' y1='4' y2='4' />
    <line x1='21' x2='12' y1='12' y2='12' />
    <line x1='8' x2='3' y1='12' y2='12' />
    <line x1='21' x2='16' y1='20' y2='20' />
    <line x1='12' x2='3' y1='20' y2='20' />
    <circle cx='12' cy='4' r='2' />
    <circle cx='6' cy='12' r='2' />
    <circle cx='14' cy='20' r='2' />
  </Icon>
);
