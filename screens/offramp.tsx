import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';

import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import Header from '@components/Header/Header';
import Loader from '@components/Loader/Loader';
import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';
import { IXO_CHAIN_ID, TERMINAL_OFFRAMP_STATUSES } from '@constants/yellowcard';
import { useAuth } from '@hooks/useAuth';
import useOfframp from '@hooks/useOfframp';
import { getStatus as getSkipStatus } from 'lib/skip/skipBridge';
import {
  type OfframpTransaction,
  type QuoteResult,
  type YcChannel,
  type YcNetwork,
  discoverChannels,
  fetchSupportedCountries,
} from 'lib/yellowcard/offrampClient';
import { ALL_COUNTRY_OPTIONS, countryOptions } from '@utils/countries';
import { type KycPrefill, hasKycCredential, loadKycPrefill } from '@utils/kycPrefill';
import { loadKycCredentialJwt } from '@utils/approvePayment';
import { type OfframpProfile, loadOfframpProfile, saveOfframpProfile } from '@utils/offrampProfile';
import { getUsdcBalance } from '@utils/usdcBalance';

import styles from '@styles/Offramp.module.scss';

// Sender ID types — independent of the payout bank's country. NIN is not listed
// here: it's auto-applied (with BVN) when the sender's own country is Nigeria.
const ID_TYPE_OPTIONS = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's license" },
];

// TEMP (testing only): set true to bypass the KYC-credential gate so the
// withdraw form shows regardless of whether the user holds a KYC credential.
// Leave false in production — withdrawals require a verified identity.
const BYPASS_KYC_CHECK = false;

// TEMP (testnet smoke test): enable the off-ramp on testnet (YC sandbox) and
// skip the Skip Go bridge + on-chain USDC balance — there's no testnet USDC, so
// we just exercise the YC create / KYC / momo destination flow. The worker still
// enforces KYC server-side. SET BACK TO false BEFORE PRODUCTION.
const TESTNET_TEST_MODE = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VERIFIED_LABEL = 'From your verified identity';
const KYC_INFO_LABEL =
  'We’ve filled in and locked the details from your verified identity. Complete any remaining fields below.';
const ESTIMATE_NOTE =
  'Estimated — the final payout can vary slightly with exchange-rate and fee changes at settlement.';

function networkChannelIds(network: YcNetwork): string[] {
  if (Array.isArray(network.channelIds)) return network.channelIds.filter(Boolean);
  if (network.channelId) return [network.channelId];
  return [];
}

type PayoutMethod = 'bank' | 'momo';

const PAYOUT_METHOD_LABEL: Record<PayoutMethod, string> = {
  bank: 'Bank transfer',
  momo: 'Mobile money',
};

/** YC has many concrete channel types (eft, bank, p2p, virtualbank, momo, …);
 *  the off-ramp only distinguishes the two rails the worker + fee-config accept. */
function mapCategory(channelType: string | null | undefined): PayoutMethod {
  return (channelType ?? '').toLowerCase() === 'momo' ? 'momo' : 'bank';
}

function isActiveWithdrawChannel(c: YcChannel): boolean {
  return (
    (c.status ? c.status.toLowerCase() === 'active' : true) &&
    (c.rampType ? c.rampType.toLowerCase() === 'withdraw' : true)
  );
}

/** The rail a network serves. YC tags every network with its own `channelType`
 *  (verified present on all networks across KE/NG/CM/UG); collapse it to the two
 *  categories the worker + fee-config accept. */
function networkMethod(network: YcNetwork): PayoutMethod {
  return mapCategory(network.channelType);
}

/** Safe dropdown label. `code` is usually a string but some bank networks return
 *  a {branch: code} object — only append it when it's actually a string. */
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

export default function OfframpScreen() {
  const router = useRouter();
  const { address, did, matrixRoomId } = useAuth();
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);
  const offramp = useOfframp();

  const isMainnet = DefaultChainNetwork === CHAIN_NETWORK_TYPE.MAINNET;
  // const isMainnet = true;
  // TEMP: gate the off-ramp UI on mainnet OR the testnet test mode; skip the
  // bridge + balance only on testnet (mainnet always does the real bridge).
  const offrampEnabled = isMainnet || TESTNET_TEST_MODE;
  const skipBridge = TESTNET_TEST_MODE && !isMainnet;

  const [balance, setBalance] = useState<number | null>(null);
  const [heldDenom, setHeldDenom] = useState<string | undefined>(undefined);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [amount, setAmount] = useState<string>('');
  const [country, setCountry] = useState<string>('ZA');
  const [supportedOptions, setSupportedOptions] = useState<{ value: string; label: string }[]>([]);
  const [bankNetworks, setBankNetworks] = useState<YcNetwork[]>([]);
  const [channels, setChannels] = useState<YcChannel[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('bank');
  const [networkId, setNetworkId] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  // TEMP (testnet): YC sandbox decides the crypto-receive (directSettlement)
  // outcome from the SENDER NAME — "Successful" or "Failure" anywhere in it. We
  // append the keyword to the name sent to YC only (the displayed/stored KYC name
  // is untouched); the worker's KYC name-match still passes (given+family remain).
  const [simOutcome, setSimOutcome] = useState<'success' | 'failure'>('success');

  const [kycName, setKycName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycEmail, setKycEmail] = useState('');
  const [kycDob, setKycDob] = useState('');
  const [kycCountry, setKycCountry] = useState('ZA');
  const [kycIdType, setKycIdType] = useState('passport');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycBvn, setKycBvn] = useState('');

  // Best-effort prefill from the user's verified identity (KYC credential + PII).
  // Fields we resolve are locked; the rest stay editable.
  const [prefill, setPrefill] = useState<KycPrefill | null>(null);
  // KYC gate: null = still checking, true/false = whether they hold a credential.
  const [hasKyc, setHasKyc] = useState<boolean | null>(null);
  // The raw KYC SD-JWT presentation, sent to the worker to verify at payout time.
  const [kycCredentialJwt, setKycCredentialJwt] = useState<string | null>(null);
  // Remembered fields from a previous withdrawal (editable, overridable). Lower
  // priority than KYC prefill — only fills fields KYC didn't lock.
  const [savedProfile, setSavedProfile] = useState<OfframpProfile | null>(null);
  const appliedSavedRef = useRef(false);
  // Monotonic token so a slow channel load for a PREVIOUS country can't apply
  // its result over the current one (which would wrongly reset the payout rail).
  const loadReqRef = useRef(0);
  // Saved bank id waiting to be applied once this country's bank list loads.
  const [pendingBankId, setPendingBankId] = useState<string | null>(null);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null);
  const [skipStatuses, setSkipStatuses] = useState<Record<string, string>>({});

  const isNG = kycCountry === 'NG';
  // Effective KYC gate — forced open when the testing bypass is on.
  const kycGate: boolean | null = BYPASS_KYC_CHECK ? true : hasKyc;

  // Balance (canonical mainnet USDC denom).
  useEffect(() => {
    if (!isMainnet || !address) return;
    let cancelled = false;
    setBalanceLoading(true);
    getUsdcBalance(address)
      .then((b) => {
        if (cancelled) return;
        setBalance(b.amount);
        setHeldDenom(b.denom);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMainnet, address]);

  // Best-effort: load the user's verified KYC identity (matrix must be ready).
  // Any failure (no credential, undecryptable, matrix not ready) just leaves the
  // fields editable. No "load once" ref guard here on purpose: under React
  // StrictMode the mount→unmount→remount cycle would otherwise let the first
  // (cancelled) run win and discard the result. Each run owns its own
  // `cancelled` flag, and the load is idempotent.
  useEffect(() => {
    if (!offrampEnabled || !address || !matrixRoomId) return;
    let cancelled = false;
    (async () => {
      try {
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (cancelled || !mxClient) return;
        // Gate first (cheap, unencrypted index read), then prefill if they qualify.
        const owns = hasKycCredential(mxClient, matrixRoomId);
        if (cancelled) return;
        setHasKyc(owns);
        // setHasKyc(false);
        // Remembered fields from a previous withdrawal (editable prefill).
        const saved = await loadOfframpProfile(mxClient, matrixRoomId);
        if (!cancelled) setSavedProfile(saved);
        if (!owns) return;
        const result = await loadKycPrefill(mxClient, matrixRoomId);
        if (!cancelled) setPrefill(result);
        // The raw SD-JWT to present to the worker's KYC gate at payout time.
        const jwt = await loadKycCredentialJwt(mxClient, matrixRoomId).catch(() => null);
        if (!cancelled) setKycCredentialJwt(jwt);
      } catch {
        /* best-effort — leave the gate "checking" if matrix isn't reachable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offrampEnabled, address, matrixRoomId, awaitCompletion, getMatrixClient]);

  // Apply the prefill into the form once it arrives.
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

  // Apply remembered fields (once) — editable, and only where KYC didn't lock
  // the field (KYC wins; its apply effect above overwrites + locks regardless of
  // order). The saved bank is deferred until its country's list loads.
  useEffect(() => {
    if (!savedProfile || appliedSavedRef.current) return;
    appliedSavedRef.current = true;
    // Payout details — never KYC-locked.
    if (savedProfile.country) setCountry(savedProfile.country);
    if (savedProfile.payoutMethod === 'bank' || savedProfile.payoutMethod === 'momo') {
      setPayoutMethod(savedProfile.payoutMethod);
    }
    if (savedProfile.accountNumber) setAccountNumber(savedProfile.accountNumber);
    if (savedProfile.accountName) setAccountName(savedProfile.accountName);
    if (savedProfile.networkId) setPendingBankId(savedProfile.networkId);
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

  // Apply the saved bank once its country's channels have loaded and it's still
  // a valid option (loadBanks resets networkId on country change).
  useEffect(() => {
    if (!pendingBankId) return;
    if (bankNetworks.some((n) => n.id === pendingBankId)) {
      setNetworkId(pendingBankId);
      setPendingBankId(null);
    }
  }, [pendingBankId, bankNetworks]);

  // Supported payout countries — from the worker (single source of truth).
  useEffect(() => {
    let cancelled = false;
    fetchSupportedCountries()
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

  const loadBanks = useCallback(async () => {
    const req = ++loadReqRef.current;
    setLoadingBanks(true);
    setFormError(null);
    setNetworkId('');
    setQuote(null);
    // Clear the previous country's data immediately so a stale in-flight response
    // can't drive availableMethods / auto-routing for the wrong country.
    setChannels([]);
    setBankNetworks([]);
    try {
      const { channels: ch, networks } = await discoverChannels(country);
      if (req !== loadReqRef.current) return; // superseded by a newer country load
      setChannels(ch);
      setBankNetworks(networks.filter((n) => (n.status ? n.status.toLowerCase() === 'active' : true) && n.name));
    } catch (err) {
      if (req !== loadReqRef.current) return;
      setFormError(err instanceof Error ? err.message : 'Failed to load banks');
    } finally {
      if (req === loadReqRef.current) setLoadingBanks(false);
    }
  }, [country]);

  useEffect(() => {
    if (offrampEnabled && country) void loadBanks();
  }, [offrampEnabled, country, loadBanks]);

  const isMomo = payoutMethod === 'momo';

  // Which rails this country actually offers (from its active withdraw channels),
  // so we only show a method the user can complete.
  const availableMethods = useMemo<PayoutMethod[]>(() => {
    const s = new Set<PayoutMethod>();
    for (const c of channels) if (isActiveWithdrawChannel(c)) s.add(mapCategory(c.channelType));
    // Stable order: bank first, then momo.
    return (['bank', 'momo'] as PayoutMethod[]).filter((m) => s.has(m));
  }, [channels]);

  // Networks (banks or mobile-money providers) for the selected rail only —
  // keyed off each network's own channelType.
  const methodNetworks = useMemo<YcNetwork[]>(
    () => bankNetworks.filter((n) => networkMethod(n) === payoutMethod),
    [bankNetworks, payoutMethod],
  );

  const channelCandidates = useMemo<YcChannel[]>(() => {
    if (!networkId) return [];
    const net = bankNetworks.find((n) => n.id === networkId);
    if (!net) return [];
    const ids = new Set(networkChannelIds(net));
    return channels.filter((c) => ids.has(c.id) && isActiveWithdrawChannel(c) && mapCategory(c.channelType) === payoutMethod);
  }, [networkId, bankNetworks, channels, payoutMethod]);

  const currency = useMemo(() => channelCandidates.find((c) => c.currency)?.currency ?? '', [channelCandidates]);
  // The rail is the user's explicit choice — no longer inferred from channels.
  const channelType = payoutMethod;
  const settlementSecs = useMemo(
    () => channelCandidates.find((c) => c.estimatedSettlementTime)?.estimatedSettlementTime,
    [channelCandidates],
  );
  const selectedBankName = useMemo(
    () => bankNetworks.find((n) => n.id === networkId)?.name ?? '',
    [bankNetworks, networkId],
  );

  // Keep the selected rail valid for the country: if the current method isn't
  // offered here, fall back to the first one that is.
  useEffect(() => {
    if (availableMethods.length && !availableMethods.includes(payoutMethod)) {
      setPayoutMethod(availableMethods[0]);
    }
  }, [availableMethods, payoutMethod]);

  // Drop a selected network that doesn't belong to the active rail (e.g. after
  // switching method or reloading the country's networks).
  useEffect(() => {
    if (networkId && !methodNetworks.some((n) => n.id === networkId)) {
      setNetworkId('');
      setQuote(null);
    }
  }, [methodNetworks, networkId]);

  // The quote is only valid for the exact amount + channel it was taken for.
  const clearOfframpError = offramp.clearError;
  useEffect(() => {
    setQuote(null);
    setFormError(null);
    clearOfframpError();
  }, [amount, currency, channelType, clearOfframpError]);

  // Once an attempt is created, clear the amount and expand the new row.
  const activeId = offramp.active?.id;
  useEffect(() => {
    if (activeId) {
      setAmount('');
      setExpandedTxId(activeId);
    }
  }, [activeId]);

  const transactions = offramp.transactions;
  const hasInflightTx = transactions.some((t) => !TERMINAL_OFFRAMP_STATUSES.has(t.status));
  const refreshTransactions = offramp.refreshTransactions;

  // Load history once on mount.
  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    if (offrampEnabled && address) {
      didInitialLoadRef.current = true;
      void refreshTransactions().catch(() => undefined);
    }
  }, [offrampEnabled, address, refreshTransactions]);

  // Poll the list every 10s while anything is in-flight.
  useEffect(() => {
    if (!hasInflightTx) return;
    const interval = setInterval(() => void refreshTransactions().catch(() => undefined), 10000);
    return () => clearInterval(interval);
  }, [hasInflightTx, refreshTransactions]);

  // Live Skip bridge state for the expanded row.
  useEffect(() => {
    if (!expandedTxId) return;
    const tx = transactions.find((t) => t.id === expandedTxId);
    if (!tx?.skip_tx_hash) return;
    let cancelled = false;
    getSkipStatus(IXO_CHAIN_ID, tx.skip_tx_hash)
      .then((s) => {
        if (!cancelled) setSkipStatuses((prev) => ({ ...prev, [tx.id]: s.state }));
      })
      .catch(() => {
        if (!cancelled) setSkipStatuses((prev) => ({ ...prev, [tx.id]: 'unknown' }));
      });
    return () => {
      cancelled = true;
    };
  }, [expandedTxId, transactions]);

  const amountNum = parseFloat(amount);
  const showForm = Number.isFinite(amountNum) && amountNum > 0;
  const overBalance = Number.isFinite(amountNum) && balance != null && amountNum > balance;

  const fiatOut = quote?.fiatReceived != null ? Number(quote.fiatReceived) : null;
  const candidateMins = channelCandidates.map((c) => c.min).filter((n): n is number => typeof n === 'number');
  const candidateMaxs = channelCandidates.map((c) => c.max).filter((n): n is number => typeof n === 'number');
  const aggMin = candidateMins.length ? Math.min(...candidateMins) : null;
  const aggMax = candidateMaxs.length ? Math.max(...candidateMaxs) : null;
  const limitMin = quote?.transactionLimitMin ?? aggMin;
  const limitMax = quote?.transactionLimitMax ?? aggMax;
  const belowMin = !!quote && fiatOut != null && limitMin != null && fiatOut < limitMin;
  const aboveMax = !!quote && fiatOut != null && limitMax != null && fiatOut > limitMax;

  const nameValid = kycName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const emailValid = EMAIL_RE.test(kycEmail);
  const phoneDigits = kycPhone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 7;
  // Bank rail: any non-empty account number. Momo rail: a full international
  // mobile number (digits only; the `+` is added at submit), min 8 digits.
  const accountDigits = accountNumber.replace(/\D/g, '');
  const accountNumberValid = isMomo ? accountDigits.length >= 8 : accountNumber.trim().length > 0;

  const canQuote = !!currency && !!channelType && Number.isFinite(amountNum) && amountNum > 0 && !overBalance;
  const canWithdraw =
    canQuote &&
    !!quote &&
    !belowMin &&
    !aboveMax &&
    accountNumberValid &&
    !!accountName &&
    nameValid &&
    emailValid &&
    phoneValid &&
    !!kycDob &&
    !!kycCountry &&
    !!kycIdNumber &&
    (!isNG || !!kycBvn) &&
    // The worker requires the KYC SD-JWT; don't let a payout be attempted
    // without it (the testing bypass skips this client-side check).
    (BYPASS_KYC_CHECK || !!kycCredentialJwt);

  const busy = offramp.stage !== 'idle' && offramp.stage !== 'submitted' && offramp.stage !== 'error';

  // A field is locked (read-only) when it came from the user's verified identity.
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

  // Remember the fields the user typed so the next visit can pre-fill them
  // (editable). KYC-locked identity is skipped — it's re-derived from the
  // credential each time. Best-effort: never blocks the flow.
  const persistProfile = useCallback(() => {
    if (!matrixRoomId) return;
    const mxClient = getMatrixClient();
    if (!mxClient) return;
    void saveOfframpProfile(mxClient, matrixRoomId, {
      country,
      payoutMethod,
      networkId,
      bankName: selectedBankName,
      accountNumber,
      accountName,
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
    country,
    payoutMethod,
    networkId,
    selectedBankName,
    accountNumber,
    accountName,
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
    offramp.clearError();
    try {
      const preview = await offramp.previewWithdrawal({
        amountUsdc: amountNum,
        currency,
        channelType,
        country,
        sourceDenom: heldDenom,
        skipBridge,
      });
      setQuote(preview.quote);
      persistProfile();
    } catch (err) {
      setQuote(null);
      setFormError(err instanceof Error ? err.message : 'Quote failed');
    } finally {
      setQuoting(false);
    }
  }, [canQuote, offramp, amountNum, currency, channelType, country, heldDenom, skipBridge, persistProfile]);

  const onWithdraw = useCallback(async () => {
    if (!canWithdraw) return;
    setFormError(null);
    try {
      await offramp.withdraw({
        amountUsdc: amountNum,
        currency,
        channelType,
        sourceDenom: heldDenom,
        skipBridge,
        kycCredential: kycCredentialJwt ?? '',
        customer: {
          // TEMP (testnet): append the sandbox crypto-receive simulation keyword
          // so YC settles the directSettlement payout (no real crypto on testnet).
          name: skipBridge ? `${kycName} ${simOutcome === 'failure' ? 'Failure' : 'Successful'}` : kycName,
          country: kycCountry,
          phone: `+${phoneDigits}`,
          email: kycEmail,
          dob: formatDob(kycDob),
          idType: isNG ? 'NIN' : kycIdType,
          idNumber: kycIdNumber,
          additionalIdNumber: isNG ? kycBvn : '',
        },
        destination: {
          accountName,
          // Momo: the destination is the mobile number in international format
          // (+countrycode…); bank: the account number as entered.
          accountNumber: isMomo ? `+${accountDigits}` : accountNumber.trim(),
          accountType: payoutMethod,
          networkId: networkId || '',
          country,
          // The institution name (bank or mobile-money provider) — recorded for
          // history/proof; the worker only forwards it to YC for the bank rail.
          bankName: selectedBankName,
        },
      });
      persistProfile();
    } catch {
      /* surfaced via offramp.error */
    }
  }, [
    canWithdraw,
    offramp,
    amountNum,
    currency,
    channelType,
    heldDenom,
    skipBridge,
    simOutcome,
    kycCredentialJwt,
    kycName,
    country,
    phoneDigits,
    kycEmail,
    kycDob,
    kycCountry,
    isNG,
    kycIdType,
    kycIdNumber,
    kycBvn,
    accountName,
    accountNumber,
    accountDigits,
    isMomo,
    payoutMethod,
    networkId,
    selectedBankName,
    persistProfile,
  ]);

  const onRetry = useCallback(
    async (tx: OfframpTransaction) => {
      setRetryingId(tx.id);
      try {
        await offramp.retryBridge(tx, heldDenom);
      } catch {
        /* surfaced via offramp.error */
      } finally {
        setRetryingId(null);
      }
    },
    [offramp, heldDenom],
  );

  const onDownloadRecord = useCallback(
    async (tx: OfframpTransaction) => {
      setDownloadingRecordId(tx.id);
      try {
        const blob = await offramp.downloadPaymentRecord(tx.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payment-record-${tx.yc_payment_id ?? tx.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Could not download the payment record');
      } finally {
        setDownloadingRecordId(null);
      }
    },
    [offramp],
  );

  return (
    <div className={styles.page}>
      <Header onGradient title='Withdraw' onBack={() => router.push('/profile')} />

      {/* Green gradient band behind the (fixed) header so its onGradient styles apply. */}
      <div className={styles.headerBand} />

      <main className={styles.body}>
        {!offrampEnabled && <div className={styles.alertInfo}>Withdrawals aren’t available on this network.</div>}

        {offrampEnabled && (
          <>
            {/* Balance */}
            <div className={styles.card}>
              {skipBridge ? (
                <div className={styles.balanceRow}>
                  <span className={styles.balanceUnit}>Testnet test mode — balance &amp; bridging skipped.</span>
                </div>
              ) : balance == null ? (
                <div className={styles.balanceRow}>
                  <span className={styles.balanceUnit}>
                    {address ? 'Loading USDC balance…' : 'Sign in to see your USDC balance.'}
                  </span>
                  {balanceLoading && <Loader size={16} />}
                </div>
              ) : (
                <div className={styles.balanceRow}>
                  <span className={styles.balanceAmount}>{formatUsdc(balance)}</span>
                  <span className={styles.balanceUnit}>USDC</span>
                  {balanceLoading && <Loader size={16} />}
                </div>
              )}
            </div>

            {kycGate === null && (
              <div className={styles.card}>
                <div className={styles.balanceRow}>
                  <Loader size={16} />
                  <span className={styles.balanceUnit}>Checking your verification…</span>
                </div>
              </div>
            )}

            {kycGate === false && (
              <div className={styles.card}>
                <p className={styles.cardTitle}>Verify your identity first</p>
                <p className={styles.kycGateText}>
                  You need to complete identity verification (KYC) before you can withdraw. Check your verification
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

            {kycGate === true && (
              <>
                {/* Withdraw form */}
                <div className={styles.card}>
                  <p className={styles.cardTitle}>Withdraw USDC</p>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>Amount (USDC)</label>
                      <input
                        className={`${styles.input}${overBalance ? ` ${styles.inputError}` : ''}`}
                        type='number'
                        inputMode='decimal'
                        min={0}
                        placeholder='0.00'
                        value={amount}
                        onChange={(e) => setAmount(e.currentTarget.value)}
                      />
                      {overBalance && <span className={styles.errorText}>Exceeds your available USDC</span>}
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
                      {skipBridge && (
                        <div className={styles.row}>
                          <div className={styles.field}>
                            <label className={styles.label}>TEST · simulate settlement</label>
                            <select
                              className={styles.select}
                              value={simOutcome}
                              onChange={(e) => setSimOutcome(e.currentTarget.value as 'success' | 'failure')}
                            >
                              <option value='success'>Success</option>
                              <option value='failure'>Failure</option>
                            </select>
                            <span className={styles.hint}>
                              Sandbox crypto-receive outcome — appended to the sender name sent to YellowCard.
                            </span>
                          </div>
                        </div>
                      )}

                      {availableMethods.length > 1 && (
                        <div className={styles.row}>
                          <div className={styles.field}>
                            <label className={styles.label}>Payout method</label>
                            <select
                              className={styles.select}
                              value={payoutMethod}
                              onChange={(e) => {
                                // Switching rail invalidates the provider + number
                                // (and any quote) — start that part of the form fresh.
                                setPayoutMethod(e.currentTarget.value as PayoutMethod);
                                setNetworkId('');
                                setAccountNumber('');
                                setQuote(null);
                              }}
                            >
                              {availableMethods.map((m) => (
                                <option key={m} value={m}>
                                  {PAYOUT_METHOD_LABEL[m]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>{isMomo ? 'Mobile provider' : 'Bank'}</label>
                          <select
                            className={styles.select}
                            value={networkId}
                            disabled={loadingBanks || methodNetworks.length === 0}
                            onChange={(e) => {
                              setNetworkId(e.currentTarget.value);
                              setQuote(null);
                            }}
                          >
                            <option value=''>
                              {loadingBanks
                                ? 'Loading…'
                                : methodNetworks.length
                                ? isMomo
                                  ? 'Select your provider'
                                  : 'Select your bank'
                                : isMomo
                                ? 'No providers for this country'
                                : 'No banks for this country'}
                            </option>
                            {methodNetworks.map((n) => (
                              <option key={n.id} value={n.id}>
                                {networkLabel(n)}
                              </option>
                            ))}
                          </select>
                          {currency && (limitMin != null || limitMax != null) && (
                            <span className={styles.hint}>
                              Limits {limitMin ?? '?'}–{limitMax ?? '?'} {currency}
                              {settlementSecs ? ` · ~${settlementSecs}s settlement` : ''}
                            </span>
                          )}
                        </div>
                        {currency && (
                          <div className={styles.field}>
                            <label className={styles.label}>Paid out in</label>
                            <input className={styles.input} value={currency} readOnly />
                            <span className={styles.hint}>
                              {isMomo ? 'Currency this wallet receives' : 'Currency this bank receives'}
                            </span>
                          </div>
                        )}
                      </div>

                      {networkId && channelCandidates.length === 0 && (
                        <span className={styles.warnLine}>
                          {isMomo ? 'No active withdraw channel for this provider.' : 'No active withdraw channel for this bank.'}
                        </span>
                      )}

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>{isMomo ? 'Mobile money number' : 'Bank account number'}</label>
                          {isMomo ? (
                            <div
                              className={`${styles.inputPrefixWrap}${
                                accountNumber && !accountNumberValid ? ` ${styles.inputError}` : ''
                              }`}
                            >
                              <span className={styles.inputPrefix}>+</span>
                              <input
                                className={styles.bareInput}
                                inputMode='numeric'
                                placeholder='234801234567'
                                value={accountDigits}
                                onChange={(e) => setAccountNumber(e.currentTarget.value.replace(/[^\d]/g, ''))}
                              />
                            </div>
                          ) : (
                            <input
                              className={styles.input}
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.currentTarget.value)}
                            />
                          )}
                          {isMomo && accountNumber && !accountNumberValid && (
                            <span className={styles.errorText}>Enter the full number with country code</span>
                          )}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>{isMomo ? 'Recipient name' : 'Account holder name'}</label>
                          <input
                            className={styles.input}
                            value={accountName}
                            onChange={(e) => setAccountName(e.currentTarget.value)}
                          />
                        </div>
                      </div>

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
                            {/* <span className={styles.hint}>Required for Nigeria</span> */}
                          </div>
                        )}
                      </div>

                      {quote && (
                        <div className={`${styles.quote}${belowMin || aboveMax ? ` ${styles.quoteWarn}` : ''}`}>
                          <span className={styles.quoteMain}>
                            You receive ~{quote.fiatReceived ?? '?'} {currency}
                            <InfoIcon label={ESTIMATE_NOTE} />
                          </span>
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

                      {/* {did && <span className={styles.hint}>Linked to your DID for tracking.</span>} */}

                      <div className={styles.actions}>
                        {quote ? (
                          <Button
                            label={busy ? 'Withdrawing…' : 'Withdraw'}
                            size={BUTTON_SIZE.mediumLarge}
                            bgColor={BUTTON_BG_COLOR.primary}
                            borderColor={BUTTON_BORDER_COLOR.primary}
                            color={BUTTON_COLOR.white}
                            disabled={!canWithdraw || busy}
                            onClick={onWithdraw}
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

                  {(formError || offramp.error) && (
                    <div className={styles.alertError}>{formError || offramp.error}</div>
                  )}
                </div>

                {/* History — only shown once there's at least one withdrawal */}
                {transactions.length > 0 && (
                  <div className={styles.card}>
                    <div className={styles.historyHeader}>
                      <p className={styles.cardTitle} style={{ margin: 0 }}>
                        Your withdrawals
                      </p>
                      <button
                        type='button'
                        className={styles.iconButton}
                        aria-label='Refresh withdrawals'
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
                      const sent = tx.send_amount_usdc ?? tx.amount_usd;
                      const txYcFee = (tx.service_fee_usd ?? 0) + (tx.partner_fee_usd ?? 0);
                      const bridging = tx.status === 'created' && !!tx.skip_tx_hash;
                      const isTerminal = TERMINAL_OFFRAMP_STATUSES.has(tx.status);
                      const good = tx.status === 'completed' || tx.status === 'refunded';
                      const dest = (tx.destination ?? {}) as {
                        accountName?: string;
                        accountNumber?: string;
                        bankName?: string;
                      };
                      const txMomo = (tx.channel_type ?? '').toLowerCase() === 'momo';
                      const statusClass = bridging
                        ? styles.statusBlue
                        : isTerminal
                        ? good
                          ? styles.statusGreen
                          : styles.statusRed
                        : styles.statusBlue;
                      const statusLabel = bridging ? 'bridging' : tx.status.replace(/_/g, ' ');
                      const inProgress = (offramp.active?.id === tx.id && busy) || retryingId === tx.id;
                      const skipFailed = /ERROR|FAIL|ABANDON/i.test(skipStatuses[tx.id] ?? '');
                      const bridgeIncomplete = !tx.skip_tx_hash || skipFailed;
                      const withinWindow = tx.expires_at != null && tx.expires_at * 1000 - Date.now() > 90_000;
                      const canComplete = !isTerminal && bridgeIncomplete && withinWindow && !inProgress;
                      return (
                        <div key={tx.id} className={styles.txCard}>
                          <button className={styles.txHead} onClick={() => setExpandedTxId(expanded ? null : tx.id)}>
                            <span>
                              <span className={styles.txTitle}>
                                {sent ?? '?'} USDC → {tx.local_amount ?? '?'} {tx.local_currency ?? ''}
                              </span>
                              <br />
                              <span className={styles.txSub}>
                                {new Date(tx.created_at * 1000).toLocaleString()} · {tx.crypto_network}
                              </span>
                            </span>
                            <span className={`${styles.txStatus} ${statusClass}`}>{statusLabel}</span>
                          </button>

                          {canComplete && (
                            <div className={styles.completeBar}>
                              <span className={styles.warnLine}>
                                Transfer didn’t complete — finish before it expires.
                              </span>
                              <Button
                                label={retryingId === tx.id ? 'Completing…' : 'Complete'}
                                size={BUTTON_SIZE.small}
                                bgColor={BUTTON_BG_COLOR.primary}
                                borderColor={BUTTON_BORDER_COLOR.primary}
                                color={BUTTON_COLOR.white}
                                disabled={retryingId === tx.id}
                                onClick={() => onRetry(tx)}
                              />
                            </div>
                          )}

                          {expanded && (
                            <div className={styles.txDetail}>
                              <div className={styles.detailRow}>
                                <span>Sent from ixo</span>
                                <span className={styles.detailVal}>{sent ?? '?'} USDC</span>
                              </div>
                              {tx.skip_fee_usd != null && (
                                <div className={styles.detailRow}>
                                  <span>Bridge fee (Skip)</span>
                                  <span className={styles.detailVal}>~${tx.skip_fee_usd.toFixed(2)}</span>
                                </div>
                              )}
                              <div className={styles.detailRow}>
                                <span>Reached YellowCard</span>
                                <span className={styles.detailVal}>{tx.amount_usd ?? '?'} USDC</span>
                              </div>
                              <div className={styles.detailRow}>
                                <span>YellowCard fee</span>
                                <span className={styles.detailVal}>~${txYcFee.toFixed(2)}</span>
                              </div>
                              <div className={styles.detailRow}>
                                <span>You receive</span>
                                <span className={styles.detailVal} style={{ fontWeight: 600 }}>
                                  {tx.local_amount ?? '?'} {tx.local_currency ?? ''}
                                </span>
                              </div>
                              {tx.rate != null && (
                                <div className={styles.detailRow}>
                                  <span>Rate</span>
                                  <span className={styles.detailVal}>
                                    1 USDC ≈ {tx.rate} {tx.local_currency ?? ''}
                                  </span>
                                </div>
                              )}
                              <div className={styles.detailRow}>
                                <span>YellowCard status</span>
                                <span className={styles.detailVal} style={{ textTransform: 'capitalize' }}>
                                  {tx.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              {tx.skip_tx_hash && (
                                <div className={styles.detailRow}>
                                  <span>Bridge (Skip)</span>
                                  <span className={`${styles.detailVal}${skipFailed ? ` ${styles.statusRed}` : ''}`}>
                                    {(skipStatuses[tx.id] ?? 'checking…')
                                      .replace(/^STATE_/, '')
                                      .replace(/_/g, ' ')
                                      .toLowerCase()}
                                  </span>
                                </div>
                              )}
                              {tx.error && (
                                <span className={styles.errorText}>Error: {tx.error_detail ?? tx.error}</span>
                              )}

                              <div className={styles.divider}>Sent to</div>
                              {dest.accountName && (
                                <div className={styles.detailRow}>
                                  <span>Account holder</span>
                                  <span className={styles.detailVal}>{dest.accountName}</span>
                                </div>
                              )}
                              {dest.accountNumber && (
                                <div className={styles.detailRow}>
                                  <span>{txMomo ? 'Mobile number' : 'Account number'}</span>
                                  <span className={styles.detailVal}>{dest.accountNumber}</span>
                                </div>
                              )}
                              {dest.bankName && (
                                <div className={styles.detailRow}>
                                  <span>{txMomo ? 'Mobile money' : 'Bank'}</span>
                                  <span className={styles.detailVal}>{dest.bankName}</span>
                                </div>
                              )}
                              {tx.yc_payment_id && (
                                <div className={styles.detailRow}>
                                  <span>YellowCard payment ID</span>
                                  <span className={styles.detailVal} style={{ fontFamily: 'monospace' }}>
                                    {tx.yc_payment_id}
                                  </span>
                                </div>
                              )}

                              {tx.status === 'completed' && (
                                <div className={styles.actions}>
                                  <Button
                                    label={downloadingRecordId === tx.id ? 'Preparing…' : 'Payment record'}
                                    size={BUTTON_SIZE.small}
                                    bgColor={BUTTON_BG_COLOR.grey}
                                    borderColor={BUTTON_BORDER_COLOR.grey}
                                    color={BUTTON_COLOR.white}
                                    disabled={downloadingRecordId === tx.id}
                                    onClick={() => onDownloadRecord(tx)}
                                  />
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
// Inline info marker — a green "i" / asterisk that reveals a small tooltip on
// click (tap-friendly) or hover (native title). Closes on blur.
// ---------------------------------------------------------------------------

function InfoMark({ children, label, markClassName }: { children: ReactNode; label: string; markClassName: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Portal the bubble to <body> with fixed positioning so it escapes the form's
  // overflow:hidden collapse (which would otherwise clip it). Clamp to viewport.
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

/** Green asterisk shown in a field label when that field was auto-filled. */
function PrefilledMark() {
  return (
    <InfoMark label={VERIFIED_LABEL} markClassName={styles.asteriskMark}>
      *
    </InfoMark>
  );
}

/** Green "i" that reveals `label` on click — used by the KYC heading and the
 *  estimated-payout note. */
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
