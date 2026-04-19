import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createQueryClient, createRegistry, cosmos, ixo } from '@ixo/impactxclient-sdk';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createMatrixBidBotClient, createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';

import { fetchCollectionByCollectionId, fetchClaimsByCollectionId, fetchAllClaimsByCollectionId } from '@utils/claims';
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
import { secret } from '@utils/secrets';
import { secureLoad } from '@utils/storage';
import authConstants from '@constants/auth';
import { getMatrixOpenIdToken } from '@utils/matrix';
import { deriveEd25519KeyPairFromMnemonic, createVeramoAgent, signClaimCredential } from '@utils/veramo';
import { hasEd25519VerificationMethod, buildAddEd25519VerificationMsg } from '@utils/did';
import base58 from 'bs58';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { saveDraft, clearDraft } from '@store/slices/claimDraftsSlice';
import { setVctTemplate, setBcoTemplate, setBevTemplate } from '@store/slices/protocolsSlice';
import { setRedirectedAt } from '@store/slices/kycSlice';
import { initiateKyc, fetchKycRedirect } from '@utils/kycServer';
import { toast } from 'react-toastify';

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

  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();
  const claimBotClientRef = useRef<ReturnType<typeof createMatrixClaimBotClient>>();
  const surveyHasChangesRef = useRef(false);

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

  async function loadForm() {
    try {
      setFormLoading(true);
      setFormError(null);

      if (surveyMode === 'view' && claimId) {
        // View mode — load claim data + survey template
        const client = getClaimBotClient();
        const openIdToken = await getMatrixOpenIdToken();
        const response = await client!?.claim.v1beta1.queryClaim(collectionId, claimId, openIdToken, did);
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
          setSurveyTemplate(JSON.stringify(cached));
        } else {
          const formData = await getAdditionalInfo(url);
          dispatch(setVctTemplate({ protocolDid: col.protocol, template: formData, url }));
          setSurveyTemplate(JSON.stringify(formData));
        }
      } else if (surveyMode === 'kyc') {
        if (hasDraft && draft) {
          setSurveyTemplate(draft.surveyTemplate);
          surveyHasChangesRef.current = true;
        } else {
          if (!kycSurveyTemplate) throw new Error('KYC form not loaded');
          setSurveyTemplate(JSON.stringify(kycSurveyTemplate));
        }
      } else if (surveyMode === 'claim') {
        if (hasDraft && draft) {
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
            setSurveyTemplate(JSON.stringify(cached));
          } else {
            const formData = await getAdditionalInfo(url);
            dispatch(setVctTemplate({ protocolDid, template: formData, url }));
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
          setSurveyTemplate(JSON.stringify(cached));
        } else {
          const formData = await getAdditionalInfo(url);
          dispatch(setBcoTemplate({ protocolDid: col.protocol, template: formData, url }));
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
          setSurveyTemplate(JSON.stringify(cached));
        } else {
          const formData = await getAdditionalInfo(url);
          dispatch(setBevTemplate({ protocolDid: col.protocol, template: formData, url }));
          setSurveyTemplate(JSON.stringify(formData));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Something went wrong');
      toast.error(message || 'Something went wrong');
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
      model.applyTheme(themeJson);
      model.allowCompleteSurveyAutomatic = false;

      configureFileQuestions(model);

      // View mode — read-only with pre-filled data
      if (surveyMode === 'view') {
        createAttachDownloadHandler(did)(model);
        if (viewClaimData) model.data = viewClaimData;
        model.mode = 'display';
        model.showNavigationButtons = 'none' as any;
        return model;
      }

      // Attach upload + download handlers for claim and bid modes
      createAttachUploadHandler(collectionId, did)(model);
      createAttachDownloadHandler(did)(model);

      // Restore draft data if available
      if (draft?.surveyData && draft.surveyMode === surveyMode) {
        model.data = draft.surveyData;
      }

      function preventComplete(sender: any, options: any) {
        options.allowComplete = false;
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
            dispatch(clearDraft(collectionId));
            window.location.href = url;
            return;
          }
          if (surveyMode === 'bco' || surveyMode === 'bev') {
            setSubmitting({ active: true, label: 'Submitting application...' });
            const client = getBidBotClient();
            const openIdToken = await getMatrixOpenIdToken();
            const role = surveyMode === 'bev' ? 'EA' : 'SA';
            const response = await client!?.bid.v1beta1.submitBid(
              collectionId,
              JSON.stringify(sender.data),
              role,
              openIdToken,
              did,
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
            const openIdToken = await getMatrixOpenIdToken();
            const col = await fetchCollectionByCollectionId(collectionId);
            const response = await client!?.claim.v1beta1.saveClaim(
              collectionId,
              JSON.stringify(signedVC),
              openIdToken,
              did,
            );
            if (!response.data.cid) throw new Error('Failed to submit claim');

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
          }
          // Success — clear draft and navigate back
          setSubmitting({ active: false, label: '' });
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
      }
    };
  }, [survey, handleSurveyValueChanged]);

  // Determine if this claim can be evaluated
  const viewedClaim = viewClaimId ? allClaims.find((c: any) => c.claimId === viewClaimId) : null;
  const viewedClaimIsPending = viewedClaim && !viewedClaim.evaluationByClaimId?.status;
  const canEvaluate = isEvalAgent && surveyMode === 'view' && viewedClaimIsPending;

  function handleClose() {
    if (surveyMode === 'view') {
      router.push(collectionUrl);
      return;
    }
    if (surveyHasChangesRef.current) {
      setCloseConfirmVisible(true);
    } else {
      router.push(collectionUrl);
    }
  }

  function handleConfirmSave() {
    // Draft is already saved via onValueChanged — just navigate back
    setCloseConfirmVisible(false);
    router.push(collectionUrl);
  }

  function handleConfirmDiscard() {
    setCloseConfirmVisible(false);
    dispatch(clearDraft(collectionId));
    router.push(collectionUrl);
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
    <div
      style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header bar — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          height: 'var(--header-height)',
          gap: '4px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleClose}
          aria-label='Back'
          style={{
            background: 'var(--card-bg-color)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width='20'
            height='20'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <polyline points='15 18 9 12 15 6' />
          </svg>
        </button>
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            background: 'var(--card-bg-color)',
            borderRadius: '8px',
            padding: '0 12px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          {title}
        </h3>
      </div>

      {/* Content area */}
      {formLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
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
      ) : formError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--error-color)', marginBottom: '16px' }}>{formError}</p>
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
            {/* @ts-ignore */}
            <Survey model={survey} />
          </div>
        </>
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
              backgroundColor: '#2F6A59',
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
                  color: evalConfirm.status === 'approve' ? '#2F6A59' : 'var(--error-color)',
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
