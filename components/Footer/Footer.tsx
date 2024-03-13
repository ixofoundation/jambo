import { useState } from 'react';

import { useRouter } from 'next/router';

import Anchor from '@components/Anchor/Anchor';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import ArrowLeft from '@icons/arrow_left.svg';
import ArrowRight from '@icons/arrow_right.svg';
import Correct from '@icons/correct.svg';
import Slider from '@icons/slider.svg';
import Touch from '@icons/touch.svg';
import Wallet from '@icons/wallet.svg';
// import useWindowDimensions from '@hooks/windowDimensions';
import { backRoute, replaceRoute } from '@utils/router';

import styles from './Footer.module.scss';

type FooterProps = {
  onBackUrl?: string;
  onBack?: (() => void) | null;
  backLabel?: string;
  onCorrect?: (() => void) | null;
  correctLabel?: string;
  onForward?: (() => void) | null;
  forwardLabel?: string;
  showAccountButton?: boolean;
  showActionsButton?: boolean;
  sliderActionButton?: (() => void) | null;
  children?: React.ReactNode;
};

/**
 * If [onForward] or [onCorrect] is undefined then no button, if null then disabled button.
 */
const Footer = ({
  onBack,
  // backLabel,
  onBackUrl,
  onCorrect,
  // correctLabel,
  onForward,
  // forwardLabel,
  showAccountButton,
  showActionsButton,
  sliderActionButton,
  children,
}: FooterProps) => {
  // const { width } = useWindowDimensions();
  const [isSliderActive, setIsSliderActive] = useState<boolean>(false);
  const { asPath } = useRouter();

  return (
    <footer className={styles.footer}>
      {(onBack || onBackUrl || onBackUrl === '') && (
        <ButtonRound
          onClick={() => (onBack ? onBack() : onBackUrl === '' ? backRoute() : replaceRoute(onBackUrl!))}
          color={BUTTON_ROUND_COLOR.lightGrey}
          size={BUTTON_ROUND_SIZE.large}
        >
          <ColoredIcon icon={ArrowLeft} size={24} color={ICON_COLOR.primary} />
          {/* {!!width && width > 425 && <p className={styles.label}>{backLabel ?? 'Back'}</p>} */}
        </ButtonRound>
      )}
      {sliderActionButton !== undefined && (
        <ButtonRound
          color={isSliderActive ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          onClick={
            sliderActionButton
              ? () => {
                  sliderActionButton();
                  setIsSliderActive((isSliderActive) => !isSliderActive);
                }
              : undefined
          }
          size={BUTTON_ROUND_SIZE.large}
        >
          <ColoredIcon icon={Slider} size={24} color={isSliderActive ? ICON_COLOR.white : ICON_COLOR.primary} />
        </ButtonRound>
      )}
      {showAccountButton && (
        <Anchor href='/account' active={asPath !== '/account'}>
          <ButtonRound
            size={BUTTON_ROUND_SIZE.large}
            color={/^\/account/i.test(asPath) ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          >
            <ColoredIcon
              icon={Wallet}
              size={24}
              color={/^\/account/i.test(asPath) ? ICON_COLOR.white : ICON_COLOR.primary}
            />
            {/* {!!width && width > 425 && <p className={styles.label}>Account</p>} */}
          </ButtonRound>
        </Anchor>
      )}
      {children}
      {showActionsButton && (
        <Anchor href='/' active={asPath !== '/'}>
          <ButtonRound
            size={BUTTON_ROUND_SIZE.large}
            color={asPath === '/' ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          >
            <ColoredIcon icon={Touch} size={24} color={asPath === '/' ? ICON_COLOR.white : ICON_COLOR.primary} />
          </ButtonRound>
        </Anchor>
      )}
      {onCorrect !== undefined && (
        <ButtonRound
          color={onCorrect ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          onClick={onCorrect ?? undefined}
          size={BUTTON_ROUND_SIZE.large}
        >
          <Correct width='24px' height='24px' />
          {/* {!!width && width > 425 && <p className={styles.label}>{correctLabel ?? 'Next'}</p>} */}
        </ButtonRound>
      )}
      {onForward !== undefined && (
        <ButtonRound
          color={onForward ? undefined : BUTTON_ROUND_COLOR.lightGrey}
          onClick={onForward ?? undefined}
          size={BUTTON_ROUND_SIZE.large}
        >
          <ArrowRight width='24px' height='24px' />
          {/* {!!width && width > 425 && <p className={styles.label}>{forwardLabel ?? 'Done'}</p>} */}
        </ButtonRound>
      )}
    </footer>
  );
};

export default Footer;
