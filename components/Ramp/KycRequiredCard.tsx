import { useRouter } from 'next/router';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import type { RampKycCredentialFailureCode } from 'lib/yellowcard/offrampClient';
import { type KycCredentialStatus, resolveKycCredentialStatus } from '@utils/kyc/rampCredentialStatus';

import styles from '@styles/Offramp.module.scss';

/**
 * Identity-verification notices shared by the Withdraw and Deposit screens.
 *
 * The yellowcard-worker decides when a transaction needs identity
 * verification; these components only explain that decision. Deliberately,
 * the copy never mentions the rule behind it — no amounts, no limits, no
 * "try a smaller amount" — the user is simply asked to verify now.
 *
 * All user-facing strings for this live here so the two screens can't drift.
 */

export type RampKind = 'withdraw' | 'deposit';

export { resolveKycCredentialStatus, type KycCredentialStatus };

const KYC_ROUTE = '/profile/credentials/kyc';
/**
 * For a verification the worker refused: the identity screen then offers a new
 * check to a person whose earlier (legacy) verification it would otherwise
 * show as "verified, nothing more to do".
 */
const REVERIFY_ROUTE = `${KYC_ROUTE}?reverify=1`;
const VERIFICATION_STATUS_ROUTE = '/profile';

const RAMP_VERB: Record<RampKind, string> = {
  withdraw: 'withdraw',
  deposit: 'deposit',
};

const VERIFY_LABEL = 'Verify my identity';
const VIEW_STATUS_LABEL = 'View verification status';
const CONTINUE_LABEL = 'Continue my identity check';
const TRY_AGAIN_LABEL = 'Try again';

type KycRequiredCardProps = {
  ramp: RampKind;
  /** Never 'ready' — a user whose verification loaded doesn't see this card. */
  credentialStatus: Exclude<KycCredentialStatus, 'ready'>;
  /** Re-read the Vault and the shared state ('not_on_device' offers it). */
  onRetry?: () => void;
};

type CardCopy = { title: string; text: string; label: string; route: string | null };

function cardCopy(status: Exclude<KycCredentialStatus, 'ready' | 'checking'>, ramp: RampKind): CardCopy {
  switch (status) {
    case 'none':
      return {
        title: 'Verify your identity to continue',
        text: `To ${RAMP_VERB[ramp]}, we first need to verify your identity. It takes a few minutes and you only need to do it once.`,
        label: VERIFY_LABEL,
        route: KYC_ROUTE,
      };
    case 'pending':
      return {
        title: 'Your identity check isn’t finished yet',
        text: `You can ${RAMP_VERB[ramp]} as soon as your identity check is complete.`,
        label: CONTINUE_LABEL,
        route: KYC_ROUTE,
      };
    case 'not_on_device':
      return {
        title: 'Almost ready',
        text: 'Your identity is verified, but your credential isn’t available on this device yet. Please try again shortly.',
        label: TRY_AGAIN_LABEL,
        route: null,
      };
    case 'unreadable':
      return {
        title: 'Verify your identity to continue',
        text: 'We found your identity verification but couldn’t open it on this device. Check your verification status to continue.',
        label: VIEW_STATUS_LABEL,
        route: VERIFICATION_STATUS_ROUTE,
      };
    case 'unavailable':
      return {
        title: 'Verify your identity to continue',
        text: 'We couldn’t check your identity verification right now. Please try again in a moment.',
        label: VIEW_STATUS_LABEL,
        route: VERIFICATION_STATUS_ROUTE,
      };
  }
}

/**
 * Shown where the action button would be when the worker says this amount needs
 * identity verification and we have no verification to send. 'checking' is the
 * exception: a small inline line rendered ABOVE the (disabled) action button
 * while the Vault is still being read.
 */
export default function KycRequiredCard({ ramp, credentialStatus, onRetry }: KycRequiredCardProps) {
  const router = useRouter();

  if (credentialStatus === 'checking') {
    return (
      <div className={`${styles.balanceRow} ${styles.kycChecking}`} role='status'>
        <Loader size={16} />
        <span className={styles.balanceUnit}>Checking your verification…</span>
      </div>
    );
  }

  const copy = cardCopy(credentialStatus, ramp);
  const { route } = copy;
  const onClick = route ? () => router.push(route) : onRetry;

  return (
    <div className={styles.kycCard} role='status'>
      <p className={styles.kycCardTitle}>{copy.title}</p>
      <p className={styles.kycCardText}>{copy.text}</p>
      {onClick && (
        <div className={styles.actions}>
          <Button
            label={copy.label}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            color={BUTTON_COLOR.white}
            onClick={onClick}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A verification WAS sent with the create call, but the worker couldn't accept
// it (only returned when the amount needs identity verification).
// ---------------------------------------------------------------------------

type CredentialFailureCopy = {
  message: string;
  /** Offer "Verify my identity" when re-verifying is what fixes it. */
  offerVerify: boolean;
};

const REVERIFY: CredentialFailureCopy = {
  message: 'We couldn’t confirm your identity verification. Please verify again.',
  offerVerify: true,
};

const TRY_LATER: CredentialFailureCopy = {
  message: 'We couldn’t check your identity verification right now. Please try again in a few minutes.',
  offerVerify: false,
};

const UNSUPPORTED_TYPE: CredentialFailureCopy = {
  message:
    'Your identity is verified, but withdrawals and deposits don’t accept this type of verification yet. Please try again later or contact support.',
  offerVerify: false,
};

const CREDENTIAL_FAILURE_COPY: Record<RampKycCredentialFailureCode, CredentialFailureCopy> = {
  expired: { message: 'Your identity verification has expired. Please verify again.', offerVerify: true },
  not_yet_valid: {
    message: 'Your identity verification isn’t active yet. Please try again a little later.',
    offerVerify: false,
  },
  name_mismatch: {
    message: 'The name you entered doesn’t match your verified identity. Please check it and try again.',
    offerVerify: false,
  },
  holder_mismatch: {
    message: 'This identity verification belongs to a different account. Please verify again with this account.',
    offerVerify: true,
  },
  // The verification itself can't be trusted as presented — a fresh one fixes it.
  bad_signature: REVERIFY,
  malformed: REVERIFY,
  bad_disclosure: REVERIFY,
  // A valid verification of a kind the worker does not accept (yet): today, a
  // Self credential before the YellowCard worker trusts its issuer and type.
  // Verifying again would produce the same credential, so it is not offered.
  untrusted_issuer: UNSUPPORTED_TYPE,
  wrong_type: UNSUPPORTED_TYPE,
  // Our side couldn't complete the check — nothing for the user to redo.
  issuer_key_unpublished: TRY_LATER,
  resolver_error: TRY_LATER,
  verify_error: TRY_LATER,
};

/** The worker refused the credential itself: verifying again is what fixes it. */
export function isReverifyCredentialFailure(code: RampKycCredentialFailureCode): boolean {
  return CREDENTIAL_FAILURE_COPY[code].offerVerify;
}

export function KycCredentialFailureNotice({ code }: { code: RampKycCredentialFailureCode }) {
  const router = useRouter();
  const copy = CREDENTIAL_FAILURE_COPY[code];

  return (
    <div className={styles.kycCard} role='alert'>
      <p className={styles.kycCardText}>{copy.message}</p>
      {copy.offerVerify && (
        <div className={styles.actions}>
          <Button
            label={VERIFY_LABEL}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.primary}
            borderColor={BUTTON_BORDER_COLOR.primary}
            color={BUTTON_COLOR.white}
            onClick={() => router.push(REVERIFY_ROUTE)}
          />
        </div>
      )}
    </div>
  );
}
