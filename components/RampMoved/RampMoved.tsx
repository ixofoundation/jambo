import cls from 'classnames';
import { useRouter } from 'next/router';

import buttonStyles from '@components/Button/Button.module.scss';
import { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Header from '@components/Header/Header';
import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';

import rampStyles from '@styles/Offramp.module.scss';
import styles from './RampMoved.module.scss';

/** The site that serves deposits and withdrawals now. This one still builds
 *  the retired Noble route, so its ramps are switched off rather than kept. */
const NEW_SITE_ORIGIN =
  DefaultChainNetwork === CHAIN_NETWORK_TYPE.MAINNET ? 'https://jambo.yoma.world' : 'https://test.jambo.yoma.world';

const COPY = {
  deposit: {
    headerTitle: 'Deposit',
    title: 'Deposits have moved',
    text: 'Deposits are no longer available on this site. To buy USDC, please use our new site and sign in with the same account. You can track your earlier deposits there too.',
    path: '/profile/onramp',
  },
  withdraw: {
    headerTitle: 'Withdraw',
    title: 'Withdrawals have moved',
    text: 'Withdrawals are no longer available on this site. To cash out your USDC, please use our new site and sign in with the same account. You can track your earlier withdrawals there too.',
    path: '/profile/offramp',
  },
} as const;

export default function RampMoved({ kind }: { kind: keyof typeof COPY }) {
  const router = useRouter();
  const { headerTitle, title, text, path } = COPY[kind];

  return (
    <div className={rampStyles.page}>
      <Header onGradient title={headerTitle} onBack={() => router.push('/profile')} />

      <div className={rampStyles.headerBand} />

      <main className={rampStyles.body}>
        <div className={cls(rampStyles.card, styles.card)}>
          <span className={styles.icon} aria-hidden='true'>
            <svg
              width={24}
              height={24}
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='7' y1='17' x2='17' y2='7' />
              <polyline points='8 7 17 7 17 16' />
            </svg>
          </span>

          <p className={cls(rampStyles.cardTitle, styles.title)}>{title}</p>
          <p className={cls(rampStyles.kycGateText, styles.text)}>{text}</p>

          {/* A real link, in the Button component's look: this leaves the site. */}
          <a
            href={`${NEW_SITE_ORIGIN}${path}`}
            className={cls(
              buttonStyles.button,
              buttonStyles[BUTTON_SIZE.mediumLarge],
              buttonStyles[BUTTON_COLOR.white],
              buttonStyles[BUTTON_BG_COLOR.primary],
              buttonStyles[BUTTON_BORDER_COLOR.primary],
              buttonStyles.squared,
              buttonStyles.textCentered,
              styles.link,
            )}
          >
            Continue to the new site
          </a>

          <p className={styles.host}>{NEW_SITE_ORIGIN.replace('https://', '')}</p>
        </div>
      </main>
    </div>
  );
}
