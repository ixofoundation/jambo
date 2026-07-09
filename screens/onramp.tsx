import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';

import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';
import { TERMINAL_ONRAMP_STATUSES } from '@constants/yellowcard';
import { useAuth } from '@hooks/useAuth';
import useOnramp from '@hooks/useOnramp';
import {
  type OnrampQuoteResult,
  type YcChannel,
  type YcNetwork,
  discoverChannels,
  fetchSupportedCountries,
} from 'lib/yellowcard/offrampClient';
import { ALL_COUNTRY_OPTIONS, countryOptions } from '@utils/countries';
import { type KycPrefill, loadKycPrefill, waitForKycCredential } from '@utils/kycPrefill';
import { loadKycCredentialJwt } from '@utils/approvePayment';
import { type OfframpProfile, loadOfframpProfile, saveOfframpProfile } from '@utils/offrampProfile';

import styles from '@styles/Offramp.module.scss';

// Sender ID types — NIN is auto-applied (with BVN) when the user's own country
// is Nigeria, same as the withdraw flow.
const ID_TYPE_OPTIONS = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's license" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VERIFIED_LABEL = 'From your verified identity';
const KYC_INFO_LABEL =
  'We’ve filled in and locked the details from your verified identity. Complete any remaining fields below.';
const ESTIMATE_NOTE =
  'Estimated — you’ll see the exact amount you’ll receive before you pay (the rate locks when you continue).';

function networkChannelIds(network: YcNetwork): string[] {
  if (Array.isArray(network.channelIds)) return network.channelIds.filter(Boolean);
  if (network.channelId) return [network.channelId];
  return [];
}

type PayMethod = 'bank' | 'momo';

const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  bank: 'Bank transfer',
  momo: 'Mobile money',
};

/** Collapse YC's concrete channel types (bank, p2p, virtualbank, momo, …) to
 *  the two rails we offer — same rule as the withdraw screen + worker. */
function mapCategory(channelType: string | null | undefined): PayMethod {
  return (channelType ?? '').toLowerCase() === 'momo' ? 'momo' : 'bank';
}

function networkMethod(network: YcNetwork): PayMethod {
  return mapCategory(network.channelType);
}

/** Only ACTIVE DEPOSIT channels count for paying in. The worker filters too,
 *  but never trust that here — an unfiltered list once let this screen offer
 *  a country whose deposit channels were all inactive in production. */
function isActiveDepositChannel(c: YcChannel): boolean {
  return (
    (c.status ? c.status.toLowerCase() === 'active' : false) &&
    (c.rampType ? c.rampType.toLowerCase() === 'deposit' : false)
  );
}

/** Safe dropdown label (`code` can be a {branch: code} object — see withdraw). */
function networkLabel(n: YcNetwork): string {
  const name = n.name ?? n.id;
  const code = typeof n.code === 'string' ? n.code : '';
  return code ? `${name} (${code})` : name;
}

function formatDob(value: string): string {
  // <input type="date"> gives YYYY-MM-DD; YC expects MM/DD/YYYY.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return '';
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function formatUsdc(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** Statuses where the user still needs to pay (payment instructions shown). */
const AWAITING_PAYMENT_STATUSES = new Set(['created', 'pending_approval', 'process', 'processing', 'pending']);

/** User-facing status label — the raw lifecycle values are worker/YC jargon. */
function statusLabel(status: string): string {
  switch (status) {
    case 'created':
    case 'pending_approval':
    case 'process':
    case 'processing':
      return 'processing';
    case 'pending':
      return 'awaiting payment';
    case 'complete':
      return 'payment received';
    case 'settlement_pending':
    case 'settlement_processing':
      return 'converting';
    case 'settlement_complete':
    case 'bridging':
      return 'delivering';
    case 'delivered':
      return 'delivered';
    case 'bridge_failed':
      return 'delivery issue';
    default:
      return status.replace(/_/g, ' ');
  }
}

export default function OnrampScreen() {
  const router = useRouter();
  const { address, matrixRoomId } = useAuth();
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);
  const onramp = useOnramp();

  // The on-ramp is mainnet-only: the bridge leg (Base→ixo) doesn't exist on
  // testnet. No test scaffolding here — small prod amounts are the smoke test.
  const onrampEnabled = DefaultChainNetwork === CHAIN_NETWORK_TYPE.MAINNET;

  const [amount, setAmount] = useState<string>('');
  const [country, setCountry] = useState<string>('KE');
  const [supportedOptions, setSupportedOptions] = useState<{ value: string; label: string }[]>([]);
  const [networks, setNetworks] = useState<YcNetwork[]>([]);
  const [channels, setChannels] = useState<YcChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('bank');
  const [networkId, setNetworkId] = useState<string>('');
  // The mobile-money number the user pays FROM (digits, international format).
  const [momoNumber, setMomoNumber] = useState('');

  const [kycName, setKycName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycEmail, setKycEmail] = useState('');
  const [kycDob, setKycDob] = useState('');
  const [kycCountry, setKycCountry] = useState('ZA');
  const [kycIdType, setKycIdType] = useState('passport');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycBvn, setKycBvn] = useState('');

  const [prefill, setPrefill] = useState<KycPrefill | null>(null);
  const [hasKyc, setHasKyc] = useState<boolean | null>(null);
  const [kycCredentialJwt, setKycCredentialJwt] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState<OfframpProfile | null>(null);
  const appliedSavedRef = useRef(false);
  // Monotonic token so a slow channel load for a PREVIOUS country can't apply
  // its result over the current one (same race fix as the withdraw screen).
  const loadReqRef = useRef(0);
  const [pendingNetworkId, setPendingNetworkId] = useState<string | null>(null);

  const [quote, setQuote] = useState<OnrampQuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isNG = kycCountry === 'NG';

  // Best-effort: load the user's verified KYC identity + remembered profile
  // (same mechanics as the withdraw screen — see comments there).
  useEffect(() => {
    if (!onrampEnabled || !address || !matrixRoomId) return;
    let cancelled = false;
    (async () => {
      try {
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (cancelled || !mxClient) return;
        // Waits out a still-syncing client — a one-shot read right after
        // login can miss room state and wrongly gate a KYC'd user.
        const owns = await waitForKycCredential(mxClient, matrixRoomId, { cancelled: () => cancelled });
        if (cancelled) return;
        setHasKyc(owns);
        const saved = await loadOfframpProfile(mxClient, matrixRoomId);
        if (!cancelled) setSavedProfile(saved);
        if (!owns) return;
        const result = await loadKycPrefill(mxClient, matrixRoomId);
        if (!cancelled) setPrefill(result);
        const jwt = await loadKycCredentialJwt(mxClient, matrixRoomId).catch(() => null);
        if (!cancelled) setKycCredentialJwt(jwt);
      } catch {
        /* best-effort — leave the gate "checking" if matrix isn't reachable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onrampEnabled, address, matrixRoomId, awaitCompletion, getMatrixClient]);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.name) setKycName(prefill.name);
    if (prefill.dob) setKycDob(prefill.dob);
    if (prefill.country) setKycCountry(prefill.country);
    if (prefill.idType) setKycIdType(prefill.idType);
    if (prefill.idNumber) setKycIdNumber(prefill.idNumber);
    if (prefill.email) setKycEmail(prefill.email);
    if (prefill.phone) setKycPhone(prefill.phone);
  }, [prefill]);

  // Apply remembered fields (once). On-ramp uses its own profile keys so the
  // withdraw flow's bank details never leak into the deposit form.
  useEffect(() => {
    if (!savedProfile || appliedSavedRef.current) return;
    appliedSavedRef.current = true;
    if (savedProfile.onrampCountry) setCountry(savedProfile.onrampCountry);
    if (savedProfile.onrampMethod === 'bank' || savedProfile.onrampMethod === 'momo') {
      setPayMethod(savedProfile.onrampMethod);
    }
    if (savedProfile.onrampMomoNumber) setMomoNumber(savedProfile.onrampMomoNumber);
    if (savedProfile.onrampNetworkId) setPendingNetworkId(savedProfile.onrampNetworkId);
    if (savedProfile.bvn) setKycBvn(savedProfile.bvn);
    // Contact / identity — only when KYC didn't provide (and lock) them.
    if (savedProfile.name && !prefill?.name) setKycName(savedProfile.name);
    if (savedProfile.phone && !prefill?.phone) setKycPhone(savedProfile.phone);
    if (savedProfile.email && !prefill?.email) setKycEmail(savedProfile.email);
    if (savedProfile.dob && !prefill?.dob) setKycDob(savedProfile.dob);
    if (savedProfile.nationality && !prefill?.country) setKycCountry(savedProfile.nationality);
    if (savedProfile.idType && !prefill?.idType) setKycIdType(savedProfile.idType);
    if (savedProfile.idNumber && !prefill?.idNumber) setKycIdNumber(savedProfile.idNumber);
  }, [savedProfile, prefill]);

  // Apply the saved provider once its country's networks have loaded.
  useEffect(() => {
    if (!pendingNetworkId) return;
    if (networks.some((n) => n.id === pendingNetworkId)) {
      setNetworkId(pendingNetworkId);
      setPendingNetworkId(null);
    }
  }, [pendingNetworkId, networks]);

  // Supported pay-in countries — from the worker (single source of truth).
  useEffect(() => {
    let cancelled = false;
    fetchSupportedCountries('onramp')
      .then((codes) => {
        if (!cancelled) setSupportedOptions(countryOptions(codes));
      })
      .catch(() => {
        if (!cancelled) setSupportedOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the selection valid: snap an unsupported country (the default, or a
  // stale saved one — pay-in coverage differs from payout coverage) to the
  // first supported option.
  useEffect(() => {
    if (!supportedOptions.length) return;
    if (!supportedOptions.some((o) => o.value === country)) {
      setCountry(supportedOptions[0].value);
    }
  }, [supportedOptions, country]);

  const loadChannels = useCallback(async () => {
    const req = ++loadReqRef.current;
    setLoadingChannels(true);
    setFormError(null);
    setNetworkId('');
    setQuote(null);
    setChannels([]);
    setNetworks([]);
    try {
      const { channels: ch, networks: nets } = await discoverChannels(country, 'deposit');
      if (req !== loadReqRef.current) return; // superseded by a newer country load
      setChannels(ch.filter(isActiveDepositChannel));
      setNetworks(nets.filter((n) => (n.status ? n.status.toLowerCase() === 'active' : true) && n.name));
    } catch (err) {
      if (req !== loadReqRef.current) return;
      setFormError(err instanceof Error ? err.message : 'Failed to load payment methods');
    } finally {
      if (req === loadReqRef.current) setLoadingChannels(false);
    }
  }, [country]);

  useEffect(() => {
    if (onrampEnabled && country) void loadChannels();
  }, [onrampEnabled, country, loadChannels]);

  const isMomo = payMethod === 'momo';

  // Rails this country offers for paying IN (`channels` is already filtered
  // to active deposit channels at load time).
  const availableMethods = useMemo<PayMethod[]>(() => {
    const s = new Set<PayMethod>();
    for (const c of channels) s.add(mapCategory(c.channelType));
    return (['bank', 'momo'] as PayMethod[]).filter((m) => s.has(m));
  }, [channels]);

  // Momo providers serving this country's deposit channels. Networks are
  // shared across ramps, so require an overlap with an active deposit channel
  // (fall back to the rail match alone if none links up).
  const momoNetworks = useMemo<YcNetwork[]>(() => {
    const momoChannelIds = new Set(channels.filter((c) => mapCategory(c.channelType) === 'momo').map((c) => c.id));
    const all = networks.filter((n) => networkMethod(n) === 'momo');
    const linked = all.filter((n) => networkChannelIds(n).some((id) => momoChannelIds.has(id)));
    return linked.length ? linked : all;
  }, [networks, channels]);

  const methodChannels = useMemo<YcChannel[]>(
    () => channels.filter((c) => mapCategory(c.channelType) === payMethod),
    [channels, payMethod],
  );

  const currency = useMemo(() => methodChannels.find((c) => c.currency)?.currency ?? '', [methodChannels]);
  const selectedProviderName = useMemo(
    () => networks.find((n) => n.id === networkId)?.name ?? '',
    [networks, networkId],
  );

  // Keep the selected rail valid for the country.
  useEffect(() => {
    if (availableMethods.length && !availableMethods.includes(payMethod)) {
      setPayMethod(availableMethods[0]);
    }
  }, [availableMethods, payMethod]);

  // Drop a selected provider that doesn't serve the active rail.
  useEffect(() => {
    if (networkId && !momoNetworks.some((n) => n.id === networkId)) {
      setNetworkId('');
      setQuote(null);
    }
  }, [momoNetworks, networkId]);

  // The quote is only valid for the exact amount + rail it was taken for.
  const clearOnrampError = onramp.clearError;
  useEffect(() => {
    setQuote(null);
    setFormError(null);
    clearOnrampError();
  }, [amount, currency, payMethod, clearOnrampError]);

  // Once a deposit is created, clear the amount and expand the new row.
  const activeId = onramp.active?.id;
  useEffect(() => {
    if (activeId) {
      setAmount('');
      setExpandedTxId(activeId);
    }
  }, [activeId]);

  const transactions = onramp.transactions;
  const hasInflightTx = transactions.some((t) => !TERMINAL_ONRAMP_STATUSES.has(t.status));
  const refreshTransactions = onramp.refreshTransactions;

  // Load history once on mount.
  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    if (onrampEnabled && address) {
      didInitialLoadRef.current = true;
      void refreshTransactions().catch(() => undefined);
    }
  }, [onrampEnabled, address, refreshTransactions]);

  // Poll the list every 10s while anything is in-flight (payment detection,
  // conversion and the bridge all progress server-side).
  useEffect(() => {
    if (!hasInflightTx) return;
    const interval = setInterval(() => void refreshTransactions().catch(() => undefined), 10000);
    return () => clearInterval(interval);
  }, [hasInflightTx, refreshTransactions]);

  const amountNum = parseFloat(amount);
  const showForm = Number.isFinite(amountNum) && amountNum > 0;

  const limitMin = quote?.transactionLimitMin ?? null;
  const limitMax = quote?.transactionLimitMax ?? null;
  const belowMin = limitMin != null && Number.isFinite(amountNum) && amountNum < limitMin;
  const aboveMax = limitMax != null && Number.isFinite(amountNum) && amountNum > limitMax;

  const nameValid = kycName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const emailValid = EMAIL_RE.test(kycEmail);
  const phoneDigits = kycPhone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 7;
  const momoDigits = momoNumber.replace(/\D/g, '');
  const momoNumberValid = !isMomo || momoDigits.length >= 8;

  const canQuote = !!currency && Number.isFinite(amountNum) && amountNum > 0;
  const canDeposit =
    canQuote &&
    !!quote &&
    // A zero estimate means fees eat the whole amount — the worker would
    // reject the create anyway; don't let the user reach that error.
    (quote.estimatedUsdcReceive ?? 0) > 0 &&
    !belowMin &&
    !aboveMax &&
    momoNumberValid &&
    (!isMomo || !!networkId) &&
    nameValid &&
    emailValid &&
    phoneValid &&
    !!kycDob &&
    !!kycCountry &&
    !!kycIdNumber &&
    (!isNG || !!kycBvn) &&
    !!kycCredentialJwt;

  const busy = onramp.stage !== 'idle' && onramp.stage !== 'submitted' && onramp.stage !== 'error';

  const locked = {
    name: !!prefill?.name,
    dob: !!prefill?.dob,
    country: !!prefill?.country,
    idType: !!prefill?.idType,
    idNumber: !!prefill?.idNumber,
    email: !!prefill?.email,
    phone: !!prefill?.phone,
  };
  const hasPrefill = Object.values(locked).some(Boolean);

  const persistProfile = useCallback(() => {
    if (!matrixRoomId) return;
    const mxClient = getMatrixClient();
    if (!mxClient) return;
    // The store is whole-blob latest-wins (no server-side merge), so spread
    // the loaded profile first — otherwise saving deposit fields would WIPE
    // the withdraw flow's saved bank details.
    void saveOfframpProfile(mxClient, matrixRoomId, {
      ...(savedProfile ?? {}),
      onrampCountry: country,
      onrampMethod: payMethod,
      onrampNetworkId: networkId,
      onrampProviderName: selectedProviderName,
      onrampMomoNumber: momoDigits,
      name: prefill?.name ? undefined : kycName,
      phone: prefill?.phone ? undefined : kycPhone,
      email: prefill?.email ? undefined : kycEmail,
      dob: prefill?.dob ? undefined : kycDob,
      nationality: prefill?.country ? undefined : kycCountry,
      idType: prefill?.idType ? undefined : kycIdType,
      idNumber: prefill?.idNumber ? undefined : kycIdNumber,
      bvn: kycBvn,
    });
  }, [
    matrixRoomId,
    getMatrixClient,
    savedProfile,
    country,
    payMethod,
    networkId,
    selectedProviderName,
    momoDigits,
    prefill,
    kycName,
    kycPhone,
    kycEmail,
    kycDob,
    kycCountry,
    kycIdType,
    kycIdNumber,
    kycBvn,
  ]);

  const onQuote = useCallback(async () => {
    if (!canQuote) return;
    setQuoting(true);
    setFormError(null);
    onramp.clearError();
    try {
      const q = await onramp.previewDeposit({
        localAmount: amountNum,
        currency,
        channelType: payMethod,
        country,
      });
      setQuote(q);
      persistProfile();
    } catch (err) {
      setQuote(null);
      setFormError(err instanceof Error ? err.message : 'Quote failed');
    } finally {
      setQuoting(false);
    }
  }, [canQuote, onramp, amountNum, currency, payMethod, country, persistProfile]);

  const onDeposit = useCallback(async () => {
    if (!canDeposit) return;
    setFormError(null);
    try {
      await onramp.deposit({
        localAmount: amountNum,
        currency,
        country,
        channelType: payMethod,
        source: {
          accountType: payMethod,
          ...(isMomo ? { accountNumber: `+${momoDigits}`, networkId, networkName: selectedProviderName } : {}),
        },
        customer: {
          name: kycName,
          country: kycCountry,
          phone: `+${phoneDigits}`,
          email: kycEmail,
          dob: formatDob(kycDob),
          idType: isNG ? 'NIN' : kycIdType,
          idNumber: kycIdNumber,
          additionalIdNumber: isNG ? kycBvn : '',
        },
        // Only the South African channel redirects to a hosted payment page
        // and needs a return URL — YC rejects it as required there, and other
        // channels haven't been verified to accept the field.
        returnUrl:
          country === 'ZA' && typeof window !== 'undefined' ? `${window.location.origin}/profile/onramp` : undefined,
        kycCredential: kycCredentialJwt ?? '',
      });
      persistProfile();
    } catch {
      /* surfaced via onramp.error */
    }
  }, [
    canDeposit,
    onramp,
    amountNum,
    currency,
    country,
    payMethod,
    isMomo,
    momoDigits,
    networkId,
    selectedProviderName,
    kycName,
    kycCountry,
    phoneDigits,
    kycEmail,
    kycDob,
    isNG,
    kycIdType,
    kycIdNumber,
    kycBvn,
    kycCredentialJwt,
    persistProfile,
  ]);

  const copyToClipboard = useCallback((key: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 2000);
    });
  }, []);

  return (
    <div className={styles.page}>
      <Header onGradient title='Deposit' onBack={() => router.push('/profile')} />

      <div className={styles.headerBand} />

      <main className={styles.body}>
        {!onrampEnabled && <div className={styles.alertInfo}>Deposits aren’t available on this network.</div>}

        {onrampEnabled && (
          <>
            {hasKyc === null && (
              <div className={styles.card}>
                <div className={styles.balanceRow}>
                  <Loader size={16} />
                  <span className={styles.balanceUnit}>Checking your verification…</span>
                </div>
              </div>
            )}

            {hasKyc === false && (
              <div className={styles.card}>
                <p className={styles.cardTitle}>Verify your identity first</p>
                <p className={styles.kycGateText}>
                  You need to complete identity verification (KYC) before you can deposit. Check your verification
                  status on your profile.
                </p>
                <div className={styles.actions}>
                  <Button
                    label='View verification status'
                    size={BUTTON_SIZE.mediumLarge}
                    bgColor={BUTTON_BG_COLOR.primary}
                    borderColor={BUTTON_BORDER_COLOR.primary}
                    color={BUTTON_COLOR.white}
                    onClick={() => router.push('/profile')}
                  />
                </div>
              </div>
            )}

            {hasKyc === true && (
              <>
                {/* Deposit form */}
                <div className={styles.card}>
                  <p className={styles.cardTitle}>Buy USDC</p>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>You pay{currency ? ` (${currency})` : ''}</label>
                      <input
                        className={`${styles.input}${belowMin || aboveMax ? ` ${styles.inputError}` : ''}`}
                        type='number'
                        inputMode='decimal'
                        min={0}
                        placeholder='0.00'
                        value={amount}
                        onChange={(e) => setAmount(e.currentTarget.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Country</label>
                      <select
                        className={styles.select}
                        value={country}
                        onChange={(e) => setCountry(e.currentTarget.value)}
                      >
                        {supportedOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={`${styles.collapse}${showForm ? ` ${styles.collapseOpen}` : ''}`}>
                    <div className={styles.collapseInner}>
                      {availableMethods.length > 1 && (
                        <div className={styles.row}>
                          <div className={styles.field}>
                            <label className={styles.label}>Payment method</label>
                            <select
                              className={styles.select}
                              value={payMethod}
                              onChange={(e) => {
                                setPayMethod(e.currentTarget.value as PayMethod);
                                setNetworkId('');
                                setQuote(null);
                              }}
                            >
                              {availableMethods.map((m) => (
                                <option key={m} value={m}>
                                  {PAY_METHOD_LABEL[m]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {loadingChannels && (
                        <div className={styles.balanceRow}>
                          <Loader size={16} />
                          <span className={styles.balanceUnit}>Loading payment methods…</span>
                        </div>
                      )}

                      {!loadingChannels && channels.length === 0 && (
                        <span className={styles.warnLine}>No payment methods available for this country.</span>
                      )}

                      {isMomo && (
                        <div className={styles.row}>
                          <div className={styles.field}>
                            <label className={styles.label}>Mobile provider</label>
                            <select
                              className={styles.select}
                              value={networkId}
                              disabled={loadingChannels || momoNetworks.length === 0}
                              onChange={(e) => {
                                setNetworkId(e.currentTarget.value);
                                setQuote(null);
                              }}
                            >
                              <option value=''>
                                {loadingChannels
                                  ? 'Loading…'
                                  : momoNetworks.length
                                  ? 'Select your provider'
                                  : 'No providers for this country'}
                              </option>
                              {momoNetworks.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {networkLabel(n)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label}>Your mobile money number</label>
                            <div
                              className={`${styles.inputPrefixWrap}${
                                momoNumber && !momoNumberValid ? ` ${styles.inputError}` : ''
                              }`}
                            >
                              <span className={styles.inputPrefix}>+</span>
                              <input
                                className={styles.bareInput}
                                inputMode='numeric'
                                placeholder='254712345678'
                                value={momoDigits}
                                onChange={(e) => setMomoNumber(e.currentTarget.value.replace(/[^\d]/g, ''))}
                              />
                            </div>
                            {momoNumber && !momoNumberValid && (
                              <span className={styles.errorText}>Enter the full number with country code</span>
                            )}
                            <span className={styles.hint}>You’ll approve the payment on this phone.</span>
                          </div>
                        </div>
                      )}

                      {!isMomo && !loadingChannels && channels.length > 0 && (
                        <span className={styles.hint}>
                          {country === 'ZA'
                            ? 'You’ll be sent to a secure payment page to complete the transfer.'
                            : 'You’ll get the bank account and reference to pay after you continue.'}
                        </span>
                      )}

                      <div className={styles.divider}>
                        <span className={styles.dividerLabel}>
                          Your details (KYC){hasPrefill && <InfoIcon label={KYC_INFO_LABEL} />}
                        </span>
                      </div>

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>Full name{locked.name && <PrefilledMark />}</label>
                          <input
                            className={`${styles.input}${kycName && !nameValid ? ` ${styles.inputError}` : ''}`}
                            placeholder='First Last'
                            value={kycName}
                            readOnly={locked.name}
                            onChange={(e) => setKycName(e.currentTarget.value)}
                          />
                          {kycName && !nameValid && <span className={styles.errorText}>Enter first and last name</span>}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Email{locked.email && <PrefilledMark />}</label>
                          <input
                            className={`${styles.input}${kycEmail && !emailValid ? ` ${styles.inputError}` : ''}`}
                            type='email'
                            value={kycEmail}
                            readOnly={locked.email}
                            onChange={(e) => setKycEmail(e.currentTarget.value)}
                          />
                          {kycEmail && !emailValid && <span className={styles.errorText}>Invalid email</span>}
                        </div>
                      </div>

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>Phone{locked.phone && <PrefilledMark />}</label>
                          <div
                            className={`${styles.inputPrefixWrap}${
                              kycPhone && !phoneValid ? ` ${styles.inputError}` : ''
                            }${locked.phone ? ` ${styles.lockedWrap}` : ''}`}
                          >
                            <span className={styles.inputPrefix}>+</span>
                            <input
                              className={styles.bareInput}
                              inputMode='numeric'
                              placeholder='27821234567'
                              value={kycPhone}
                              readOnly={locked.phone}
                              onChange={(e) => setKycPhone(e.currentTarget.value.replace(/[^\d]/g, ''))}
                            />
                          </div>
                          {kycPhone && !phoneValid && (
                            <span className={styles.errorText}>Enter full international number</span>
                          )}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Date of birth{locked.dob && <PrefilledMark />}</label>
                          <input
                            className={styles.input}
                            type='date'
                            max={new Date().toISOString().slice(0, 10)}
                            value={kycDob}
                            readOnly={locked.dob}
                            onChange={(e) => setKycDob(e.currentTarget.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>Your country{locked.country && <PrefilledMark />}</label>
                          <select
                            className={styles.select}
                            value={kycCountry}
                            disabled={locked.country}
                            onChange={(e) => setKycCountry(e.currentTarget.value)}
                          >
                            {ALL_COUNTRY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>ID type{!isNG && locked.idType && <PrefilledMark />}</label>
                          {isNG ? (
                            <input className={styles.input} value='NIN' readOnly />
                          ) : (
                            <select
                              className={styles.select}
                              value={kycIdType}
                              disabled={locked.idType}
                              onChange={(e) => setKycIdType(e.currentTarget.value)}
                            >
                              {ID_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>
                            {isNG ? 'NIN' : 'ID number'}
                            {locked.idNumber && <PrefilledMark />}
                          </label>
                          <input
                            className={styles.input}
                            value={kycIdNumber}
                            readOnly={locked.idNumber}
                            onChange={(e) => setKycIdNumber(e.currentTarget.value)}
                          />
                        </div>
                        {isNG && (
                          <div className={styles.field}>
                            <label className={styles.label}>BVN</label>
                            <input
                              className={styles.input}
                              value={kycBvn}
                              onChange={(e) => setKycBvn(e.currentTarget.value)}
                            />
                          </div>
                        )}
                      </div>

                      {quote && (
                        <div className={`${styles.quote}${belowMin || aboveMax ? ` ${styles.quoteWarn}` : ''}`}>
                          <span className={styles.quoteMain}>
                            You receive ~{quote.estimatedUsdcReceive ?? '?'} USDC
                            <InfoIcon label={ESTIMATE_NOTE} />
                          </span>
                          {quote.rateLocal != null && (
                            <span className={styles.hint}>
                              1 USDC ≈ {quote.rateLocal} {currency} · fees ~$
                              {(
                                (quote.serviceFeeUSD ?? 0) +
                                (quote.partnerFeeUSD ?? 0) +
                                (quote.networkFeeUSDEstimate ?? 0) +
                                (quote.bridgeFeeUsd ?? 0)
                              ).toFixed(2)}
                            </span>
                          )}
                          {(quote.estimatedUsdcReceive ?? 0) <= 0 && (
                            <span className={styles.warnLine}>
                              This amount is too small — fees would use it all up. Increase the amount.
                            </span>
                          )}
                          {belowMin && limitMin != null && (
                            <span className={styles.warnLine}>
                              Below the {limitMin} {currency} minimum — increase the amount.
                            </span>
                          )}
                          {aboveMax && limitMax != null && (
                            <span className={styles.warnLine}>
                              Above the {limitMax} {currency} maximum — reduce the amount.
                            </span>
                          )}
                        </div>
                      )}

                      <div className={styles.actions}>
                        {quote ? (
                          <Button
                            label={busy ? 'Creating…' : 'Continue'}
                            size={BUTTON_SIZE.mediumLarge}
                            bgColor={BUTTON_BG_COLOR.primary}
                            borderColor={BUTTON_BORDER_COLOR.primary}
                            color={BUTTON_COLOR.white}
                            disabled={!canDeposit || busy}
                            onClick={onDeposit}
                          />
                        ) : (
                          <Button
                            label={quoting ? 'Getting quote…' : 'Get quote'}
                            size={BUTTON_SIZE.mediumLarge}
                            bgColor={BUTTON_BG_COLOR.primary}
                            borderColor={BUTTON_BORDER_COLOR.primary}
                            color={BUTTON_COLOR.white}
                            disabled={!canQuote || quoting}
                            onClick={onQuote}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {(formError || onramp.error) && <div className={styles.alertError}>{formError || onramp.error}</div>}
                </div>

                {/* History — instructions for in-flight deposits live here too */}
                {transactions.length > 0 && (
                  <div className={styles.card}>
                    <div className={styles.historyHeader}>
                      <p className={styles.cardTitle} style={{ margin: 0 }}>
                        Your deposits
                      </p>
                      <button
                        type='button'
                        className={styles.iconButton}
                        aria-label='Refresh deposits'
                        onClick={() => void refreshTransactions().catch(() => undefined)}
                      >
                        <svg
                          width={16}
                          height={16}
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='2'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        >
                          <polyline points='23 4 23 10 17 10' />
                          <polyline points='1 20 1 14 7 14' />
                          <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
                        </svg>
                      </button>
                    </div>

                    {transactions.map((tx) => {
                      const expanded = expandedTxId === tx.id;
                      const isTerminal = TERMINAL_ONRAMP_STATUSES.has(tx.status);
                      const good = tx.status === 'delivered' || tx.status === 'refunded';
                      const awaitingPayment = AWAITING_PAYMENT_STATUSES.has(tx.status);
                      const expired = tx.expires_at != null && tx.expires_at * 1000 < Date.now();
                      const txMomo = (tx.channel_type ?? '').toLowerCase() === 'momo';
                      const bankInfo = tx.bank_info ?? {};
                      const statusClass = isTerminal
                        ? good
                          ? styles.statusGreen
                          : styles.statusRed
                        : styles.statusBlue;
                      return (
                        <div key={tx.id} className={styles.txCard}>
                          <button className={styles.txHead} onClick={() => setExpandedTxId(expanded ? null : tx.id)}>
                            <span>
                              <span className={styles.txTitle}>
                                {tx.local_amount ?? '?'} {tx.currency ?? ''} →{' '}
                                {tx.net_usdc != null ? formatUsdc(tx.net_usdc) : '?'} USDC
                              </span>
                              <br />
                              <span className={styles.txSub}>
                                {new Date(tx.created_at * 1000).toLocaleString()} ·{' '}
                                {txMomo ? 'Mobile money' : 'Bank transfer'}
                              </span>
                            </span>
                            <span className={`${styles.txStatus} ${statusClass}`}>{statusLabel(tx.status)}</span>
                          </button>

                          {/* Payment instructions — shown while YC awaits the user's fiat */}
                          {awaitingPayment && !expired && (
                            <div className={styles.txDetail}>
                              {txMomo ? (
                                <span className={styles.hint}>
                                  Approve the payment request sent to your phone
                                  {(tx.source as { accountNumber?: string })?.accountNumber
                                    ? ` (${(tx.source as { accountNumber?: string }).accountNumber})`
                                    : ''}
                                  .
                                </span>
                              ) : tx.payment_link ? (
                                <>
                                  <span className={styles.hint}>
                                    Complete your payment of{' '}
                                    <strong>
                                      {tx.local_amount ?? '?'} {tx.currency ?? ''}
                                    </strong>{' '}
                                    on the secure payment page.
                                  </span>
                                  <div className={styles.actions}>
                                    <Button
                                      label='Open payment page'
                                      size={BUTTON_SIZE.small}
                                      bgColor={BUTTON_BG_COLOR.primary}
                                      borderColor={BUTTON_BORDER_COLOR.primary}
                                      color={BUTTON_COLOR.white}
                                      onClick={() => window.open(tx.payment_link ?? '', '_blank', 'noopener')}
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className={styles.hint}>
                                    Transfer exactly{' '}
                                    <strong>
                                      {tx.local_amount ?? '?'} {tx.currency ?? ''}
                                    </strong>{' '}
                                    to this account{tx.reference ? ' and include the reference' : ''}:
                                  </span>
                                  {bankInfo.name && (
                                    <div className={styles.detailRow}>
                                      <span>Bank</span>
                                      <span className={styles.detailVal}>{bankInfo.name}</span>
                                    </div>
                                  )}
                                  {bankInfo.accountName && (
                                    <div className={styles.detailRow}>
                                      <span>Account name</span>
                                      <span className={styles.detailVal}>{bankInfo.accountName}</span>
                                    </div>
                                  )}
                                  {bankInfo.accountNumber && (
                                    <div className={styles.detailRow}>
                                      <span>Account number</span>
                                      <span className={styles.detailVal} style={{ fontFamily: 'monospace' }}>
                                        {bankInfo.accountNumber}{' '}
                                        <button
                                          type='button'
                                          className={styles.iconButton}
                                          aria-label='Copy account number'
                                          onClick={() => copyToClipboard(`${tx.id}-acc`, bankInfo.accountNumber ?? '')}
                                        >
                                          {copied === `${tx.id}-acc` ? '✓' : '⧉'}
                                        </button>
                                      </span>
                                    </div>
                                  )}
                                  {tx.reference && (
                                    <div className={styles.detailRow}>
                                      <span>Reference</span>
                                      <span className={styles.detailVal} style={{ fontFamily: 'monospace' }}>
                                        {tx.reference}{' '}
                                        <button
                                          type='button'
                                          className={styles.iconButton}
                                          aria-label='Copy reference'
                                          onClick={() => copyToClipboard(`${tx.id}-ref`, tx.reference ?? '')}
                                        >
                                          {copied === `${tx.id}-ref` ? '✓' : '⧉'}
                                        </button>
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                              {tx.net_usdc != null && (
                                <span className={styles.hint}>
                                  You’ll receive <strong>~{formatUsdc(tx.net_usdc)} USDC</strong> on your ixo account.
                                </span>
                              )}
                              {tx.expires_at != null && (
                                <span className={styles.warnLine}>
                                  Pay before {new Date(tx.expires_at * 1000).toLocaleTimeString()} — the rate expires.
                                </span>
                              )}
                            </div>
                          )}

                          {expanded && (
                            <div className={styles.txDetail}>
                              <div className={styles.detailRow}>
                                <span>You pay</span>
                                <span className={styles.detailVal}>
                                  {tx.local_amount ?? '?'} {tx.currency ?? ''}
                                </span>
                              </div>
                              {tx.rate != null && (
                                <div className={styles.detailRow}>
                                  <span>Rate</span>
                                  <span className={styles.detailVal}>
                                    1 USDC ≈ {tx.rate} {tx.currency ?? ''}
                                  </span>
                                </div>
                              )}
                              <div className={styles.detailRow}>
                                <span>YellowCard fees</span>
                                <span className={styles.detailVal}>
                                  ~$
                                  {(
                                    (tx.service_fee_usd ?? 0) +
                                    (tx.network_fee_usd ?? 0) +
                                    (tx.partner_fee_usd ?? 0)
                                  ).toFixed(2)}
                                </span>
                              </div>
                              {tx.bridge_fee_usd != null && (
                                <div className={styles.detailRow}>
                                  <span>Delivery fee</span>
                                  <span className={styles.detailVal}>~${tx.bridge_fee_usd.toFixed(2)}</span>
                                </div>
                              )}
                              <div className={styles.detailRow}>
                                <span>You receive</span>
                                <span className={styles.detailVal} style={{ fontWeight: 600 }}>
                                  {tx.net_usdc != null ? formatUsdc(tx.net_usdc) : '?'} USDC
                                </span>
                              </div>
                              <div className={styles.detailRow}>
                                <span>Status</span>
                                <span className={styles.detailVal} style={{ textTransform: 'capitalize' }}>
                                  {statusLabel(tx.status)}
                                </span>
                              </div>
                              {tx.status === 'bridge_failed' && (
                                <span className={styles.warnLine}>
                                  Your payment was received but the delivery to your ixo account needs attention —
                                  support has been notified and will complete it.
                                </span>
                              )}
                              {tx.error && tx.status !== 'bridge_failed' && (
                                <span className={styles.errorText}>Error: {tx.error_detail ?? tx.error}</span>
                              )}
                              {tx.yc_collection_id && (
                                <div className={styles.detailRow}>
                                  <span>YellowCard collection ID</span>
                                  <span className={styles.detailVal} style={{ fontFamily: 'monospace' }}>
                                    {tx.yc_collection_id}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline info marker — same tap-friendly tooltip as the withdraw screen.
// ---------------------------------------------------------------------------

function InfoMark({ children, label, markClassName }: { children: ReactNode; label: string; markClassName: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const toggle = () =>
    setPos((cur) => {
      if (cur) return null;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return null;
      return { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 232)) };
    });

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={ref}
        type='button'
        className={markClassName}
        aria-label={label}
        title={label}
        onClick={toggle}
        onBlur={() => setPos(null)}
      >
        {children}
      </button>
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span className={styles.infoBubble} style={{ top: pos.top, left: pos.left }} role='tooltip'>
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}

function PrefilledMark() {
  return (
    <InfoMark label={VERIFIED_LABEL} markClassName={styles.asteriskMark}>
      *
    </InfoMark>
  );
}

function InfoIcon({ label }: { label: string }) {
  return (
    <InfoMark label={label} markClassName={styles.infoMark}>
      <svg
        width={14}
        height={14}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <circle cx='12' cy='12' r='10' />
        <line x1='12' y1='16' x2='12' y2='12' />
        <line x1='12' y1='8' x2='12.01' y2='8' />
      </svg>
    </InfoMark>
  );
}
