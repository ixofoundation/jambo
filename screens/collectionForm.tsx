import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createQueryClient, createRegistry, cosmos, ixo } from '@ixo/impactxclient-sdk';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createMatrixBidBotClient, createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';

import {
  fetchCollectionByCollectionId,
  fetchClaimsByCollectionId,
  fetchAllClaimsByCollectionId,
  fetchClaimById,
} from '@utils/claims';
import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';
import { getAdditionalInfo, getServiceEndpoint, cleanUrlString, getCachedTemplate } from '@utils/url';
import { themeJson } from '@constants/surveyTheme';
import {
  configureFileQuestions,
  createAttachUploadHandler,
  createAttachDownloadHandler,
} from '@constants/surveyDefaultConfig';
import { createAttachPdfPreviewHandler } from '@constants/surveyPdfPreview';
import '../lib/here'; // registers the `map-grid-selector` SurveyJS question type
import { secret } from '@utils/secrets';
import { secureLoad } from '@utils/storage';
import authConstants from '@constants/auth';
import { withMatrixOpenIdRetry } from '@utils/matrix';
import { deriveEd25519KeyPairFromMnemonic, createVeramoAgent, signClaimCredential } from '@utils/veramo';
import { hasEd25519VerificationMethod, buildAddEd25519VerificationMsg } from '@utils/did';
import base58 from 'bs58';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { saveDraft, clearDraft } from '@store/slices/claimDraftsSlice';
import { setVctTemplate, setBcoTemplate, setBevTemplate } from '@store/slices/protocolsSlice';
import { setRedirectedAt } from '@store/slices/kycSlice';
import { initiateKyc, fetchKycRedirect } from '@utils/kycServer';
import { toast } from 'react-toastify';
import SubclaimModal from '@components/SubclaimModal/SubclaimModal';
import ApprovePaymentSourceClaimModal from '@components/ApprovePaymentSourceClaimModal/ApprovePaymentSourceClaimModal';
import { templateRequiresBaseClaim } from '@utils/surveyTemplate';
import { registerSubclaimLinkage, refreshClaimStatus } from '../lib/yomaWorker/client';
import { APPROVE_PAYMENT_SOURCE_COLLECTIONS, isApprovePaymentCollection } from '@constants/approvePayment';
import { buildApprovePaymentPrefill, fetchSourceClaimData, loadKycPii } from '@utils/approvePayment';

const BASE_CLAIM_CID_FIELD = 'ixo:baseClaimCID';

interface CollectionFormProps {
  entityDid: string;
  collectionId: string;
  formType: 'vct' | 'bco' | 'bev' | 'view' | 'kyc';
  claimId?: string;
  closeUrl?: string;
}

export default function CollectionForm({ entityDid, collectionId, formType, claimId, closeUrl }: CollectionFormProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authContext = useAuth();
  const { awaitCompletion } = useBackgroundSetup();
  const address = authContext.address!;
  const did = authContext.did!;
  const onSign = authContext.onSign;

  const draft = useAppSelector((state) => state.claimDrafts.byCollectionId[collectionId]);
  const kycSurveyTemplate = useAppSelector((state) => state.kyc.surveyTemplate);
  const kycDeedOfferId = useAppSelector((state) => state.kyc.deedOfferId);
  const kycClaimCollectionId = useAppSelector((state) => state.kyc.claimCollectionId);

  // Map formType to surveyMode
  const surveyMode = formType === 'vct' ? 'claim' : formType === 'view' ? 'view' : formType;

  const [surveyTemplate, setSurveyTemplate] = useState<string | undefined>();
  const [viewClaimData, setViewClaimData] = useState<Record<string, any> | null>(null);
  // View mode without a stored claim document (payment claims recorded
  // directly on-chain) — renders the on-chain claim record instead.
  const [viewFallback, setViewFallback] = useState(false);
  const [fallbackClaim, setFallbackClaim] = useState<any | null>(null);
  const [viewClaimId, setViewClaimId] = useState<string | null>(claimId ?? null);
  const [formLoading, setFormLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState<{ active: boolean; label: string }>({ active: false, label: '' });
  const [evalConfirm, setEvalConfirm] = useState<{
    status: 'approve' | 'reject';
    defaultAmount?: { denom: string; amount: string };
    customAmount?: { denom: string; amount: string };
    editingAmount?: boolean;
  } | null>(null);
  const [isEvalAgent, setIsEvalAgent] = useState(false);
  const [allClaims, setAllClaims] = useState<any[]>([]);

  // Subclaim sheet state — activated by the surveyjs template itself (question named ixo:baseClaimCID)
  const requiresBaseClaim = useMemo(() => {
    if (!surveyTemplate || surveyMode !== 'claim') return false;
    try {
      return templateRequiresBaseClaim(JSON.parse(surveyTemplate));
    } catch {
      return false;
    }
  }, [surveyTemplate, surveyMode]);
  const [baseClaimCID, setBaseClaimCID] = useState<string | null>(null);
  const [subclaimBlockReason, setSubclaimBlockReason] = useState<
    'not-configured' | 'worker-unreachable' | 'no-eval-authz' | 'no-submit-authz' | null
  >(null);

  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();
  const claimBotClientRef = useRef<ReturnType<typeof createMatrixClaimBotClient>>();
  const surveyHasChangesRef = useRef(false);
  const baseClaimCIDRef = useRef<string | null>(null);
  const subclaimBlockReasonRef = useRef<typeof subclaimBlockReason>(null);
  const requiresBaseClaimRef = useRef(false);
  const parentCollectionIdRef = useRef<string | null>(null);

  // Approve-payment prefetch (source claim from one of the configured
  // APPROVE_PAYMENT_SOURCE_COLLECTIONS + the user's credential-data PII blob from
  // their matrix room). Both stashed in refs so the survey-model initialiser can
  // read them when prefilling the form.
  const approvePaymentActive = surveyMode === 'claim' && isApprovePaymentCollection(collectionId);
  const { getMatrixClient } = useBackgroundSetup();
  const [approvePaymentPrefetching, setApprovePaymentPrefetching] = useState(approvePaymentActive);
  const [approvePaymentError, setApprovePaymentError] = useState<string | null>(null);
  const [selectedSourceClaim, setSelectedSourceClaim] = useState<{ claimId: string; collectionId: string } | null>(
    null,
  );
  const sourceClaimDataRef = useRef<Record<string, any> | null>(null);
  const piiDataRef = useRef<{ eventId: string; pii: Record<string, any> } | null>(null);
  const approvePaymentPrefillAppliedRef = useRef(false);

  useEffect(() => {
    baseClaimCIDRef.current = baseClaimCID;
  }, [baseClaimCID]);
  useEffect(() => {
    subclaimBlockReasonRef.current = subclaimBlockReason;
  }, [subclaimBlockReason]);
  useEffect(() => {
    requiresBaseClaimRef.current = requiresBaseClaim;
  }, [requiresBaseClaim]);

  const collectionUrl = closeUrl ?? `/entities/${entityDid}/claimCollections/${collectionId}`;

  const hasDraft = !!draft && draft.surveyMode === surveyMode;

  // Load survey CSS
  useEffect(() => {
    // @ts-ignore
    import('survey-core/defaultV2.min.css');
    // @ts-ignore
    import('survey-core/themes/borderless-dark');
  }, []);

  // Check eval agent authz for view mode
  useEffect(() => {
    if (surveyMode !== 'view') return;
    // Evaluation flow disabled for now — skip the authz / all-claims fetch.
    return;
    // eslint-disable-next-line no-unreachable
    (async () => {
      try {
        const col = await fetchCollectionByCollectionId(collectionId);
        const queryClient = await createQueryClient(CHAIN_RPC_URL);
        const granteeGrants = await queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address });
        const registry = createRegistry();
        const grants = granteeGrants.grants as GrantAuthorization[];
        const hasEval = grants?.find((g) => {
          if (g.authorization?.typeUrl !== TRANSACTION_TYPES.EvaluateClaimAuthorization || g.granter !== col.admin)
            return false;
          try {
            const decoded = registry.decode(g.authorization);
            const constraints = decoded.constraints ?? [];
            if (constraints.length === 0) return true;
            return constraints.some((c: any) => c.collectionId === collectionId);
          } catch {
            return false;
          }
        });
        setIsEvalAgent(!!hasEval);

        // Also fetch all claims for pending check
        const result = await fetchAllClaimsByCollectionId(collectionId);
        setAllClaims(result ?? []);
      } catch {
        // silent
      }
    })();
  }, [surveyMode, collectionId, address]);

  // Load form data on mount
  useEffect(() => {
    loadForm();
  }, []);

  // Approve-payment prefetch — runs once when this is the approve-payment collection.
  // Resolves the user's source claim across all configured source collections
  // (auto-select if exactly one, otherwise open the selection modal) AND the user's
  // credential-data (PII). Both are required.
  useEffect(() => {
    if (!approvePaymentActive) return;
    let cancelled = false;
    (async () => {
      setApprovePaymentPrefetching(true);
      setApprovePaymentError(null);
      try {
        if (APPROVE_PAYMENT_SOURCE_COLLECTIONS.length === 0) {
          throw new Error('Source collections not configured (NEXT_PUBLIC_APPROVE_PAYMENT_SOURCE_COLLECTIONS).');
        }

        // 1) Fetch the user's claims for each configured source collection in
        //    parallel. Only approved claims (evaluationByClaimId.status === 1)
        //    are eligible — pending / rejected / disputed are filtered out.
        const claimsPerCollection = await Promise.all(
          APPROVE_PAYMENT_SOURCE_COLLECTIONS.map(async (cid) => {
            const all: any[] = (await fetchClaimsByCollectionId(cid, address)) || [];
            const claims = all.filter((c) => c?.evaluationByClaimId?.status === 1);
            return { cid, claims };
          }),
        );
        if (cancelled) return;

        // 2) Flatten approved claims across collections and auto-select the most
        //    recently approved one (most recent `evaluationDate`). No picker UI —
        //    selection is fully automatic.
        const allApproved = claimsPerCollection.flatMap(({ claims }) => claims);
        if (allApproved.length === 0) {
          throw new Error(
            'You do not have any approved claims in the source collections. Please submit one and wait for approval first.',
          );
        }
        const evalTs = (c: any) => {
          const raw = c?.evaluationByClaimId?.evaluationDate ?? c?.submissionDate;
          if (!raw) return 0;
          const t = new Date(raw).getTime();
          return Number.isFinite(t) ? t : 0;
        };
        allApproved.sort((a, b) => evalTs(b) - evalTs(a));
        const pick = allApproved[0];
        setSelectedSourceClaim({ claimId: pick.claimId, collectionId: pick.collectionId });

        // 3) Fetch the user's credential-data (PII) blob from their matrix room. This
        //    is the raw deed-offer payload saved alongside the verifiable credential
        //    and is what we use to prefill the personal fields on this form.
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (!mxClient) throw new Error('Matrix client not ready');
        const roomId = authContext.matrixRoomId;
        if (!roomId) throw new Error('User matrix room not available');
        const pii = await loadKycPii(mxClient, roomId);
        if (cancelled) return;
        if (!pii) {
          throw new Error('Your credential data is not in your Data Store. Please complete and save your KYC first.');
        }
        piiDataRef.current = pii;
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || 'Could not prepare this claim form';
        setApprovePaymentError(msg);
        toast.error(msg);
        // Drop the prefetching gate so the error view can render. Without this, the
        // loader keeps spinning forever and the error message never reaches the screen.
        setApprovePaymentPrefetching(false);
      }
      // Success path keeps the gate up — it's cleared by the data-load effect below
      // once the chosen claim's data has been fetched (or by the user picking from the
      // modal). For 2+ claims, the modal stays mounted while the gate is up.
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvePaymentActive]);

  // Once a source claim is selected (auto or via modal), fetch its data — scoped to
  // the collection it actually came from — and clear the prefetching gate so the
  // survey can render.
  useEffect(() => {
    if (!approvePaymentActive) return;
    if (!selectedSourceClaim) return;
    let cancelled = false;
    (async () => {
      try {
        const client = getClaimBotClient();
        if (!client) throw new Error('Claim service unavailable');
        const data = await fetchSourceClaimData({
          client,
          collectionId: selectedSourceClaim.collectionId,
          claimId: selectedSourceClaim.claimId,
          did,
        });
        if (cancelled) return;
        sourceClaimDataRef.current = data;
        setApprovePaymentPrefetching(false);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || 'Could not load source claim data';
        setApprovePaymentError(msg);
        toast.error(msg);
        setApprovePaymentPrefetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvePaymentActive, selectedSourceClaim?.claimId, selectedSourceClaim?.collectionId]);

  async function loadForm() {
    try {
      setFormLoading(true);
      setFormError(null);

      if (surveyMode === 'view' && claimId) {
        try {
          // View mode — load claim data + survey template
          const client = getClaimBotClient();
          const response = await withMatrixOpenIdRetry((token) =>
            client!?.claim.v1beta1.queryClaim(collectionId, claimId, token, did),
          );
        let claimData: Record<string, any> = {};
        if (response) {
          let parsed = typeof response === 'string' ? JSON.parse(response) : response;
          if (parsed?.data && !parsed?.credentialSubject)
            parsed = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
          if (parsed?.credentialSubject) {
            const { id, type, ...rest } = parsed.credentialSubject;
            claimData = rest;
          } else {
            claimData = parsed;
          }
        }
        setViewClaimData(claimData);

        const col = await fetchCollectionByCollectionId(collectionId);
        const protocolEntity = await fetchProtocolEntity(col.protocol);
        const endpoint =
          protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#vct')) ??
          protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('surveyTemplate'));
        if (!endpoint?.serviceEndpoint) throw new Error('Claim form not found');
        const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
        const cached = getCachedTemplate(col.protocol, 'vct', url);
        if (cached) {
          console.log({ surveyTemplate: cached });
          setSurveyTemplate(JSON.stringify(cached));
          } else {
            const formData = await getAdditionalInfo(url);
            dispatch(setVctTemplate({ protocolDid: col.protocol, template: formData, url }));
            console.log({ surveyTemplate: formData });
            setSurveyTemplate(JSON.stringify(formData));
          }
        } catch {
          // The claims bot has no stored document for this claim (payment
          // claims are recorded directly on-chain and never pass through the
          // bot) — show the on-chain claim record instead of an error.
          setViewFallback(true);
          void fetchClaimById(claimId)
            .then((c) => setFallbackClaim(c))
            .catch(() => {});
        }
      } else if (surveyMode === 'kyc') {
        if (hasDraft && draft) {
          console.log({ surveyTemplate: draft.surveyTemplate });
          setSurveyTemplate(draft.surveyTemplate);
          surveyHasChangesRef.current = true;
        } else {
          if (!kycSurveyTemplate) throw new Error('KYC form not loaded');
          console.log({ surveyTemplate: kycSurveyTemplate });
          setSurveyTemplate(JSON.stringify(kycSurveyTemplate));
        }
      } else if (surveyMode === 'claim') {
        if (hasDraft && draft) {
          console.log({ surveyTemplate: draft.surveyTemplate });
          setSurveyTemplate(draft.surveyTemplate);
          surveyHasChangesRef.current = true;
        } else {
          const protocolDid = (await fetchCollectionByCollectionId(collectionId)).protocol;
          const protocolEntity = await fetchProtocolEntity(protocolDid);
          const endpoint =
            protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#vct')) ??
            protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('surveyTemplate'));
          if (!endpoint?.serviceEndpoint) throw new Error('Claim form not found');
          const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
          const cached = getCachedTemplate(protocolDid, 'vct', url);
          if (cached) {
            console.log({ surveyTemplate: cached });
            setSurveyTemplate(JSON.stringify(cached));
          } else {
            const formData = await getAdditionalInfo(url);
            dispatch(setVctTemplate({ protocolDid, template: formData, url }));
            console.log({ surveyTemplate: formData });
            setSurveyTemplate(JSON.stringify(formData));
          }
        }
      } else if (surveyMode === 'bco') {
        const col = await fetchCollectionByCollectionId(collectionId);
        const protocolEntity = await fetchProtocolEntity(col.protocol);
        const endpoint = protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#bco'));
        if (!endpoint?.serviceEndpoint) throw new Error('Application form not found');
        const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
        const cached = getCachedTemplate(col.protocol, 'bco', url);
        if (cached) {
          console.log({ surveyTemplate: cached });
          setSurveyTemplate(JSON.stringify(cached));
        } else {
          const formData = await getAdditionalInfo(url);
          dispatch(setBcoTemplate({ protocolDid: col.protocol, template: formData, url }));
          console.log({ surveyTemplate: formData });
          setSurveyTemplate(JSON.stringify(formData));
        }
      } else if (surveyMode === 'bev') {
        const col = await fetchCollectionByCollectionId(collectionId);
        const protocolEntity = await fetchProtocolEntity(col.protocol);
        const endpoint = protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#bev'));
        if (!endpoint?.serviceEndpoint) throw new Error('Evaluation agent application form not found');
        const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
        const cached = getCachedTemplate(col.protocol, 'bev', url);
        if (cached) {
          console.log({ surveyTemplate: cached });
          setSurveyTemplate(JSON.stringify(cached));
        } else {
          const formData = await getAdditionalInfo(url);
          dispatch(setBevTemplate({ protocolDid: col.protocol, template: formData, url }));
          console.log({ surveyTemplate: formData });
          setSurveyTemplate(JSON.stringify(formData));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // No toast: formError always renders the inline error card (with Go
      // Back) on this screen — a toast would duplicate it, twice in dev where
      // StrictMode double-runs the mount effect.
      setFormError(message || 'Something went wrong');
    } finally {
      setFormLoading(false);
    }
  }

  function getBidBotClient() {
    const token = secret.accessToken as string;
    if (bidBotClientRef.current?.bid && token) return bidBotClientRef.current;
    bidBotClientRef.current = undefined;
    if (!token) return null;
    bidBotClientRef.current = createMatrixBidBotClient({
      homeServerUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL!,
      botUrl: process.env.NEXT_PUBLIC_MATRIX_BID_BOT_URL!,
      accessToken: token,
    });
    return bidBotClientRef.current;
  }

  function getClaimBotClient() {
    const token = secret.accessToken as string;
    if (claimBotClientRef.current?.claim && token) return claimBotClientRef.current;
    claimBotClientRef.current = undefined;
    if (!token) return null;
    claimBotClientRef.current = createMatrixClaimBotClient({
      homeServerUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL!,
      botUrl: process.env.NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL!,
      accessToken: token,
    });
    return claimBotClientRef.current;
  }

  function toDisplayAmount(amount: string, denom: string): { display: string; displayDenom: string } {
    if (denom === 'uixo') {
      return { display: (Number(amount) / 1_000_000).toString(), displayDenom: 'IXO' };
    }
    return { display: amount, displayDenom: denom };
  }

  function toMinimalAmount(display: string, displayDenom: string): { amount: string; denom: string } {
    if (displayDenom === 'IXO') {
      return { amount: Math.round(Number(display) * 1_000_000).toString(), denom: 'uixo' };
    }
    return { amount: display, denom: displayDenom };
  }

  async function handleApproveClick() {
    try {
      const col = await fetchCollectionByCollectionId(collectionId);
      const approvalPayment = col.payments?.approval?.amount?.[0];
      const defaultAmt = approvalPayment
        ? { denom: approvalPayment.denom as string, amount: approvalPayment.amount as string }
        : undefined;
      const displayAmt = defaultAmt ? toDisplayAmount(defaultAmt.amount, defaultAmt.denom) : undefined;
      setEvalConfirm({
        status: 'approve',
        defaultAmount: defaultAmt,
        customAmount: displayAmt ? { denom: displayAmt.displayDenom, amount: displayAmt.display } : undefined,
        editingAmount: false,
      });
    } catch {
      setEvalConfirm({ status: 'approve' });
    }
  }

  async function evaluateClaim(status: 'approve' | 'reject', customAmount?: { denom: string; amount: string }) {
    if (!viewClaimId) return;
    setEvaluating(true);
    try {
      const col = await fetchCollectionByCollectionId(collectionId);

      const amountField =
        status === 'approve' && customAmount && Number(customAmount.amount) > 0
          ? [
              cosmos.base.v1beta1.Coin.fromPartial({
                denom: customAmount.denom,
                amount: customAmount.amount,
              }),
            ]
          : [];

      const message = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: cosmos.authz.v1beta1.MsgExec.fromPartial({
          grantee: address,
          msgs: [
            {
              typeUrl: '/ixo.claims.v1beta1.MsgEvaluateClaim',
              value: ixo.claims.v1beta1.MsgEvaluateClaim.encode({
                claimId: viewClaimId,
                collectionId: collectionId,
                oracle: did,
                agentDid: did,
                agentAddress: address,
                adminAddress: col.admin as string,
                status: status === 'approve' ? 1 : 2,
                reason: 1,
                verificationProof: viewClaimId,
                amount: amountField,
                cw20Payment: [],
                cw1155Payment: [],
              }).finish(),
            },
          ] as any[],
        }),
      };
      await onSign([message]);
      toast.success(`Claim ${status === 'approve' ? 'approved' : 'rejected'} successfully`);
      router.push(collectionUrl);
    } catch (err) {
      toast.error((err as Error).message || `Failed to ${status} claim`);
      console.error('Evaluation error:', err);
    } finally {
      setEvaluating(false);
      setEvalConfirm(null);
    }
  }

  const handleSurveyValueChanged = useCallback(
    (sender: any) => {
      surveyHasChangesRef.current = true;
      if (surveyTemplate && surveyMode) {
        dispatch(
          saveDraft({
            collectionId,
            draft: {
              surveyMode,
              surveyTemplate,
              surveyData: { ...sender.data },
              updatedAt: Date.now(),
            },
          }),
        );
      }
    },
    [collectionId, surveyTemplate, surveyMode, dispatch],
  );

  const survey = useMemo(() => {
    if (!surveyTemplate || !surveyMode) return undefined;
    try {
      const parsed = JSON.parse(surveyTemplate);
      const templateData = parsed?.question ?? parsed;
      // SurveyJS expects showProgressBar as a string, but templates may provide a boolean
      if (typeof templateData.showProgressBar === 'boolean') {
        templateData.showProgressBar = templateData.showProgressBar ? templateData.progressBarLocation || 'top' : 'off';
      }
      const model = new Model(templateData);
      // The app is a mobile-width column even on desktop — SurveyJS's TOC
      // sidebar (a desktop pattern some templates enable, e.g. the KYC form)
      // would crush the form into a sliver. Page progress stays available via
      // showProgressBar.
      model.showTOC = false;
      model.applyTheme(themeJson);
      model.allowCompleteSurveyAutomatic = false;

      configureFileQuestions(model);

      // View mode — read-only with pre-filled data
      if (surveyMode === 'view') {
        createAttachDownloadHandler(did)(model);
        const disposePdfPreview = createAttachPdfPreviewHandler(did)(model);
        (model as any).__disposePdfPreview = disposePdfPreview;
        if (viewClaimData) model.data = viewClaimData;
        model.mode = 'display';
        model.showCompleteButton = false;
        return model;
      }

      // Attach upload + download handlers for claim and bid modes
      createAttachUploadHandler(collectionId, did)(model);
      createAttachDownloadHandler(did)(model);

      // Restore draft data if available
      if (draft?.surveyData && draft.surveyMode === surveyMode) {
        model.data = draft.surveyData;
      }

      // For subclaim flows, seed/overwrite the baseClaimCID field so it's present in the VC
      if (requiresBaseClaimRef.current) {
        model.data = { ...model.data, [BASE_CLAIM_CID_FIELD]: baseClaimCIDRef.current ?? '' };
      }

      // Approve-payment prefill: merge values pulled from the user's source claim
      // and their credential-data (PII) blob into the survey's initial data. Existing
      // values (from a saved draft) win — we use model.data as the base.
      if (approvePaymentActive) {
        const prefill = buildApprovePaymentPrefill(sourceClaimDataRef.current, piiDataRef.current?.pii ?? null);
        if (Object.keys(prefill).length > 0) {
          model.data = { ...prefill, ...model.data };
        }
      }

      function preventComplete(sender: any, options: any) {
        options.allowComplete = false;
        if (requiresBaseClaimRef.current && (subclaimBlockReasonRef.current || !baseClaimCIDRef.current)) {
          // Submission gated until user picks a base claim and pre-flight passes
          toast.error(
            subclaimBlockReasonRef.current
              ? 'This subcollection cannot be submitted (see message in the base-claim sheet).'
              : 'Please select a base claim before submitting.',
          );
          return;
        }
        submitForm(sender);
      }

      async function submitForm(sender: any) {
        model.onCompleting.remove(preventComplete);
        model.completeText = 'Submitting...';
        setSubmitting({ active: true, label: 'Preparing submission...' });
        try {
          await awaitCompletion();
          if (surveyMode === 'kyc') {
            setSubmitting({ active: true, label: 'Initiating verification...' });
            const protocolId = entityDid;
            await initiateKyc(did, {
              protocolId,
              claimCollectionId: kycClaimCollectionId ?? undefined,
              deedOfferId: kycDeedOfferId ?? undefined,
              address,
              data: sender.data,
            });

            setSubmitting({ active: true, label: 'Redirecting to verification...' });
            const { url } = await fetchKycRedirect(did, protocolId);
            dispatch(setRedirectedAt({ protocolId, at: Date.now() }));
            model.onValueChanged.remove(handleSurveyValueChanged);
            dispatch(clearDraft(collectionId));
            window.open(url, '_blank', 'noopener,noreferrer');
            router.push('/profile');
            return;
          }
          if (surveyMode === 'bco' || surveyMode === 'bev') {
            setSubmitting({ active: true, label: 'Submitting application...' });
            const client = getBidBotClient();
            const role = surveyMode === 'bev' ? 'EA' : 'SA';
            const response = await withMatrixOpenIdRetry((token) =>
              client!?.bid.v1beta1.submitBid(collectionId, JSON.stringify(sender.data), role, token, did),
            );
            if (!response.id) throw new Error('Failed to submit application');
          } else {
            setSubmitting({ active: true, label: 'Preparing signing key...' });
            const edMnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
            if (!edMnemonic) throw new Error('Ed25519 signing mnemonic not available — please sign in again');

            const keyPair = deriveEd25519KeyPairFromMnemonic(edMnemonic);
            const pubKeyBase58 = base58.encode(keyPair.publicKey);

            const hasVm = await hasEd25519VerificationMethod(did, pubKeyBase58);
            if (!hasVm) {
              setSubmitting({ active: true, label: 'Registering signing key...' });
              const addVmMsg = buildAddEd25519VerificationMsg(did, keyPair.publicKey, address);
              await onSign([addVmMsg]);
            }

            const agent = await createVeramoAgent(keyPair, did);
            const signedVC = await signClaimCredential(agent, did, sender.data);

            setSubmitting({ active: true, label: 'Uploading claim...' });
            const client = getClaimBotClient();
            const col = await fetchCollectionByCollectionId(collectionId);
            const response = await withMatrixOpenIdRetry((token) =>
              client!?.claim.v1beta1.saveClaim(collectionId, JSON.stringify(signedVC), token, did),
            );
            if (!response.data.cid) throw new Error('Failed to submit claim');

            if (requiresBaseClaimRef.current && parentCollectionIdRef.current && baseClaimCIDRef.current) {
              await registerSubclaimLinkage({
                parentCollectionId: parentCollectionIdRef.current,
                parentClaimId: baseClaimCIDRef.current,
                subClaimCollectionId: collectionId,
                subClaimId: response.data.cid as string,
                agentDid: did,
              });
            }

            setSubmitting({ active: true, label: 'Submitting to blockchain...' });
            const message = {
              typeUrl: '/cosmos.authz.v1beta1.MsgExec',
              value: cosmos.authz.v1beta1.MsgExec.fromPartial({
                grantee: address,
                msgs: [
                  {
                    typeUrl: '/ixo.claims.v1beta1.MsgSubmitClaim',
                    value: ixo.claims.v1beta1.MsgSubmitClaim.encode({
                      adminAddress: col.admin as string,
                      agentAddress: address,
                      agentDid: did,
                      claimId: response.data.cid as string,
                      collectionId: collectionId,
                      useIntent: false,
                      amount: [],
                      cw20Payment: [],
                      cw1155Payment: [],
                    }).finish(),
                  },
                ] as any[],
              }),
            };
            await onSign([message]);
            if (requiresBaseClaimRef.current && baseClaimCIDRef.current) {
              // Fire-and-forget: nudges the worker to refresh the new linkage's status against the chain
              refreshClaimStatus(baseClaimCIDRef.current);
            }
          }
          // Success — clear draft and navigate back
          setSubmitting({ active: false, label: '' });
          // Detach auto-save before clearing so doComplete() can't re-save the draft we just cleared.
          model.onValueChanged.remove(handleSurveyValueChanged);
          dispatch(clearDraft(collectionId));
          sender.doComplete();
          router.push(collectionUrl);
        } catch (err) {
          setSubmitting({ active: false, label: '' });
          toast.error((err as Error).message);
          console.error('error', err);
          model.completeText = 'Try again';
          model.onCompleting.add(preventComplete);
        }
      }

      model.onCompleting.add(preventComplete);
      model.completeText = 'Submit';

      model.onValueChanged.add(handleSurveyValueChanged);

      return model;
    } catch (err) {
      console.error('Failed to initialize survey model:', err);
      return undefined;
    }
  }, [surveyTemplate, surveyMode, viewClaimData]);

  // Clean up value change listener when survey is destroyed
  useEffect(() => {
    return () => {
      if (survey) {
        survey.onValueChanged.remove(handleSurveyValueChanged);
        const disposePdfPreview = (survey as any).__disposePdfPreview as (() => void) | undefined;
        if (disposePdfPreview) {
          disposePdfPreview();
          (survey as any).__disposePdfPreview = undefined;
        }
      }
    };
  }, [survey, handleSurveyValueChanged]);

  // Keep ixo:baseClaimCID in sync with the underlying survey model when the user picks a parent
  useEffect(() => {
    if (!survey || !requiresBaseClaim) return;
    try {
      survey.setValue(BASE_CLAIM_CID_FIELD, baseClaimCID ?? '');
    } catch {
      // survey model may not accept a colon-named key via setValue; fall back to mutating data
      try {
        survey.data = { ...survey.data, [BASE_CLAIM_CID_FIELD]: baseClaimCID ?? '' };
      } catch {
        // ignore
      }
    }
  }, [survey, requiresBaseClaim, baseClaimCID]);

  // Apply the approve-payment prefill once both the survey and the prefetched data
  // are ready. Memos can't depend on refs, so the in-memo prefill misses when the
  // template loads before the prefetch resolves — this effect catches that case.
  // Runs at most once per survey instance to avoid clobbering subsequent user edits.
  useEffect(() => {
    if (!approvePaymentActive) return;
    if (!survey || approvePaymentPrefetching) return;
    if (approvePaymentPrefillAppliedRef.current) return;
    const prefill = buildApprovePaymentPrefill(sourceClaimDataRef.current, piiDataRef.current?.pii ?? null);
    if (Object.keys(prefill).length === 0) return;
    Object.entries(prefill).forEach(([key, value]) => {
      try {
        survey.setValue(key, value);
      } catch {
        // Colon-named keys can trip setValue on some survey-core versions — fall back
        // to mutating data directly.
        try {
          survey.data = { ...survey.data, [key]: value };
        } catch {
          // ignore
        }
      }
    });
    approvePaymentPrefillAppliedRef.current = true;
  }, [survey, approvePaymentActive, approvePaymentPrefetching]);

  // Determine if this claim can be evaluated
  const viewedClaim = viewClaimId ? allClaims.find((c: any) => c.claimId === viewClaimId) : null;
  // On-chain record for the fallback card (blocksync direct fetch; allClaims
  // is only populated by the currently-disabled evaluation flow).
  const recordClaim = fallbackClaim ?? viewedClaim;
  const viewedClaimIsPending = viewedClaim && !viewedClaim.evaluationByClaimId?.status;
  // Evaluation flow disabled for now — re-enable by restoring the original expression.
  const canEvaluate = false && isEvalAgent && surveyMode === 'view' && viewedClaimIsPending;

  // Leave via history when we can: pushing the collection URL from here builds
  // forward entries that ping-pong with the collection page's own back button.
  function leaveForm() {
    if (typeof window !== 'undefined' && window.history.length > 2) router.back();
    else router.push(collectionUrl);
  }

  function handleClose() {
    if (surveyMode === 'view') {
      leaveForm();
      return;
    }
    if (surveyHasChangesRef.current) {
      setCloseConfirmVisible(true);
    } else {
      leaveForm();
    }
  }

  function handleConfirmSave() {
    // Draft is already saved via onValueChanged — just navigate back
    setCloseConfirmVisible(false);
    leaveForm();
  }

  function handleConfirmDiscard() {
    setCloseConfirmVisible(false);
    dispatch(clearDraft(collectionId));
    leaveForm();
  }

  const title = formLoading
    ? 'Loading...'
    : surveyMode === 'view'
    ? canEvaluate
      ? 'Evaluate Claim'
      : `Claim #${viewClaimId ?? ''}`
    : surveyMode === 'bco'
    ? 'Apply as Service Agent'
    : surveyMode === 'bev'
    ? 'Apply as Evaluation Agent'
    : surveyMode === 'kyc'
    ? hasDraft
      ? 'Continue KYC Verification'
      : 'KYC Verification'
    : hasDraft
    ? 'Continue Claim'
    : 'New Claim';

  return (
    <div style={{ overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <GradientBand {...GRADIENT_COLORS.collectionDetail} />
      <Header onGradient title={title} onBack={handleClose} hideEndAction />

      {/* Content area — main provides the header-clearance padding; the inner card holds the solid bg so the gradient stays visible behind the header */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          paddingTop: 'var(--header-height)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
          {formLoading || approvePaymentPrefetching || approvePaymentError ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: '3px solid var(--border-color)',
                    borderTopColor: 'var(--accent-color)',
                    borderRadius: '50%',
                    animation: 'formLoadSpinner 0.8s linear infinite',
                  }}
                />
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Loading form...</p>
                <style>{`
              @keyframes formLoadSpinner {
                to { transform: rotate(360deg); }
              }
            `}</style>
              </div>
            </div>
          ) : viewFallback ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div
                style={{
                  maxWidth: 420,
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  padding: '24px',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {recordClaim?.evaluationByClaimId?.status === 1 ? 'Approved claim' : 'Claim record'}
                </p>
                <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This claim was recorded directly on-chain — there’s no form submission to display.
                </p>
                {recordClaim ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <ClaimFactRow
                      label='Status'
                      value={
                        recordClaim.evaluationByClaimId?.status === 1
                          ? 'Approved'
                          : recordClaim.evaluationByClaimId?.status === 2
                          ? 'Not approved'
                          : recordClaim.evaluationByClaimId?.status === 3
                          ? 'Disputed'
                          : 'Awaiting review'
                      }
                      accent={recordClaim.evaluationByClaimId?.status === 1}
                    />
                    <ClaimFactRow label='Submitted' value={fmtClaimDateTime(recordClaim.submissionDate)} />
                    {recordClaim.evaluationByClaimId?.evaluationDate && (
                      <ClaimFactRow label='Evaluated' value={fmtClaimDateTime(recordClaim.evaluationByClaimId.evaluationDate)} />
                    )}
                    <ClaimFactRow label='Collection' value={collectionId} />
                    <ClaimFactRow label='Claim ID' value={claimId ?? ''} mono />
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>Loading claim record…</p>
                )}
              </div>
            </div>
          ) : formError ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div
                style={{
                  textAlign: 'center',
                  maxWidth: 420,
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 16,
                }}
              >
                <p style={{ fontSize: '14px', color: 'var(--error-color)', margin: 0 }}>{formError}</p>

                <button
                  onClick={() => router.push(collectionUrl)}
                  style={{
                    alignSelf: 'center',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : !survey ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Unable to load form.
                </p>
                <button
                  onClick={() => router.push(collectionUrl)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', width: '100%' }}>
                  {/* @ts-ignore */}
                  <Survey model={survey} />
                </div>
              </div>
            </>
          )}

          {requiresBaseClaim && !formLoading && !formError && (
            <SubclaimModal
              open={true}
              subclaimCollectionId={collectionId}
              address={address}
              did={did}
              selectedParentClaimId={baseClaimCID}
              onSelect={(claimId) => setBaseClaimCID(claimId)}
              onBlockedChange={setSubclaimBlockReason}
              onParentResolved={(pid) => {
                parentCollectionIdRef.current = pid;
              }}
            />
          )}

          {approvePaymentActive && (approvePaymentPrefetching || approvePaymentError) && (
            <ApprovePaymentSourceClaimModal
              open
              phase={
                approvePaymentError
                  ? { kind: 'error', message: approvePaymentError }
                  : { kind: 'loading', message: 'Loading your approved claims and credential data…' }
              }
              onClose={() => router.push(collectionUrl)}
            />
          )}

          {/* Evaluate buttons for view mode */}
          {canEvaluate && (
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <button
                onClick={() => setEvalConfirm({ status: 'reject' })}
                disabled={evaluating}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid var(--error-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--error-color)',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: evaluating ? 'default' : 'pointer',
                  opacity: evaluating ? 0.5 : 1,
                }}
              >
                Reject
              </button>
              <button
                onClick={handleApproveClick}
                disabled={evaluating}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'var(--green-secondary)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: evaluating ? 'default' : 'pointer',
                  opacity: evaluating ? 0.5 : 1,
                }}
              >
                {evaluating ? 'Processing...' : 'Approve'}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Submission overlay */}
      {submitting.active && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-color)',
                borderRadius: '50%',
                animation: 'submissionSpinner 0.8s linear infinite',
              }}
            />
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>Submitting</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>{submitting.label}</p>
            </div>
          </div>
          <style>{`
            @keyframes submissionSpinner {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Close confirmation dialog */}
      {closeConfirmVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCloseConfirmVisible(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '300px',
              margin: '0 20px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-secondary)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Unsaved changes
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Your progress has been saved as a draft. What would you like to do?
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <button
                onClick={handleConfirmSave}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--accent-color)',
                }}
              >
                Save & close
              </button>
              <button
                onClick={handleConfirmDiscard}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: 'var(--error-color)',
                }}
              >
                Discard & close
              </button>
              <button
                onClick={() => setCloseConfirmVisible(false)}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation confirmation dialog */}
      {evalConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !evaluating) setEvalConfirm(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              margin: '0 20px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-secondary)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {evalConfirm.status === 'approve' ? 'Approve Claim' : 'Reject Claim'}
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {evalConfirm.status === 'approve'
                  ? evalConfirm.defaultAmount
                    ? 'Confirm approval with the payment amount below.'
                    : 'Are you sure you want to approve this claim?'
                  : 'Are you sure you want to reject this claim? This cannot be undone.'}
              </p>
            </div>

            {/* Payment amount section for approval */}
            {evalConfirm.status === 'approve' && evalConfirm.customAmount && (
              <div style={{ padding: '0 20px 16px' }}>
                {!evalConfirm.editingAmount ? (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--card-bg-color)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Payment</span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {evalConfirm.customAmount.amount} {evalConfirm.customAmount.denom}
                      </span>
                    </div>
                    <button
                      onClick={() => setEvalConfirm({ ...evalConfirm, editingAmount: true })}
                      disabled={evaluating}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: evaluating ? 'default' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--accent-color)',
                      }}
                    >
                      Edit Payment Amount
                    </button>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid var(--accent-color)',
                        backgroundColor: 'var(--card-bg-color)',
                      }}
                    >
                      <input
                        type='number'
                        inputMode='decimal'
                        value={evalConfirm.customAmount.amount}
                        onChange={(e) =>
                          setEvalConfirm({
                            ...evalConfirm,
                            customAmount: { ...evalConfirm.customAmount!, amount: e.target.value },
                          })
                        }
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          outline: 'none',
                          minWidth: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          paddingRight: '12px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {evalConfirm.customAmount.denom}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        onClick={() => {
                          const resetAmt = evalConfirm.defaultAmount
                            ? toDisplayAmount(evalConfirm.defaultAmount.amount, evalConfirm.defaultAmount.denom)
                            : undefined;
                          setEvalConfirm({
                            ...evalConfirm,
                            editingAmount: false,
                            customAmount: resetAmt
                              ? { denom: resetAmt.displayDenom, amount: resetAmt.display }
                              : evalConfirm.customAmount,
                          });
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setEvalConfirm({ ...evalConfirm, editingAmount: false })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--accent-color)',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <button
                onClick={() => {
                  if (evalConfirm.status === 'approve' && evalConfirm.customAmount) {
                    const minimal = toMinimalAmount(evalConfirm.customAmount.amount, evalConfirm.customAmount.denom);
                    evaluateClaim('approve', minimal);
                  } else {
                    evaluateClaim(evalConfirm.status);
                  }
                }}
                disabled={evaluating}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  cursor: evaluating ? 'default' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: evalConfirm.status === 'approve' ? 'var(--green-secondary)' : 'var(--error-color)',
                }}
              >
                {evaluating ? 'Processing...' : evalConfirm.status === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => setEvalConfirm(null)}
                disabled={evaluating}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: evaluating ? 'default' : 'pointer',
                  fontSize: '15px',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-chain claim record (view-mode fallback when the claims bot holds no
// stored document — e.g. payment claims written directly on-chain).
// ---------------------------------------------------------------------------

function fmtClaimDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ClaimFactRow({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: accent ? 700 : 500,
          color: accent ? 'var(--green-primary)' : 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          textAlign: 'right',
          overflowWrap: 'anywhere',
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}
