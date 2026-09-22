import { useRouter } from 'next/router';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import type { RampKycCredentialFailureCode } from 'lib/yellowcard/offrampClient';

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

/** Where the background read of the user's verification (in their Vault) stands. */
export type KycCredentialStatus =
  /** Still looking — the Vault may be syncing. */
  | 'checking'
  /** Looked; the user holds no verification. */
  | 'none'
  /** Found and loaded — it is sent with the create call. */
  | 'ready'
  /** Found, but it couldn't be opened (decrypted) on this device. */
  | 'unreadable'
  /** The Vault couldn't be reached, so we don't know. */
  | 'unavailable';

/** Collapse the screens' loading flags into one status. `hasKyc` is the index
 *  check (null = unresolved); `credentialLoaded` flips once the attempt to open
 *  the credential itself has finished, so "found but still opening" reads as
 *  'checking' rather than flashing 'unreadable'. */
export function resolveKycCredentialStatus(state: {
  hasKyc: boolean | null;
  credentialJwt: string | null;
  credentialLoaded: boolean;
  checkFailed: boolean;
}): KycCredentialStatus {
  if (state.credentialJwt) return 'ready';
  if (state.checkFailed) return 'unavailable';
  if (state.hasKyc === null) return 'checking';
  if (state.hasKyc === false) return 'none';
  return state.credentialLoaded ? 'unreadable' : 'checking';
}

const KYC_ROUTE = '/profile/credentials/kyc';
const VERIFICATION_STATUS_ROUTE = '/profile';

const RAMP_VERB: Record<RampKind, string> = {
  withdraw: 'withdraw',
  deposit: 'deposit',
};

const VERIFY_LABEL = 'Verify my identity';
const VIEW_STATUS_LABEL = 'View verification status';

type KycRequiredCardProps = {
  ramp: RampKind;
  /** Never 'ready' — a user whose verification loaded doesn't see this card. */
  credentialStatus: Exclude<KycCredentialStatus, 'ready'>;
};

/**
 * Shown where the action button would be when the worker says this amount needs
 * identity verification and we have no verification to send. 'checking' is the
 * exception: a small inline line rendered ABOVE the (disabled) action button
 * while the Vault is still being read.
 */
export default function KycRequiredCard({ ramp, credentialStatus }: KycRequiredCardProps) {
  const router = useRouter();

  if (credentialStatus === 'checking') {
    return (
      <div className={`${styles.balanceRow} ${styles.kycChecking}`} role='status'>
        <Loader size={16} />
        <span className={styles.balanceUnit}>Checking your verification…</span>
      </div>
    );
  }

  const verify = credentialStatus === 'none';

  return (
    <div className={styles.kycCard} role='status'>
      <p className={styles.kycCardTitle}>Verify your identity to continue</p>
      <p className={styles.kycCardText}>
        {verify
          ? `To ${RAMP_VERB[ramp]}, we first need to verify your identity. It takes a few minutes and you only need to do it once.`
          : credentialStatus === 'unreadable'
          ? 'We found your identity verification but couldn’t open it on this device. Check your verification status to continue.'
          : 'We couldn’t reach your Vault to check your identity verification. Please try again in a moment.'}
      </p>
      <div className={styles.actions}>
        <Button
          label={verify ? VERIFY_LABEL : VIEW_STATUS_LABEL}
          size={BUTTON_SIZE.mediumLarge}
          bgColor={BUTTON_BG_COLOR.primary}
          borderColor={BUTTON_BORDER_COLOR.primary}
          color={BUTTON_COLOR.white}
          onClick={() => router.push(verify ? KYC_ROUTE : VERIFICATION_STATUS_ROUTE)}
        />
      </div>
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
  untrusted_issuer: REVERIFY,
  wrong_type: REVERIFY,
  bad_disclosure: REVERIFY,
  // Our side couldn't complete the check — nothing for the user to redo.
  issuer_key_unpublished: TRY_LATER,
  resolver_error: TRY_LATER,
  verify_error: TRY_LATER,
};

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
            onClick={() => router.push(KYC_ROUTE)}
          />
        </div>
      )}
    </div>
  );
}
