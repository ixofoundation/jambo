import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createQueryClient, createRegistry, cosmos, ixo } from '@ixo/impactxclient-sdk';
import { createMatrixBidBotClient, createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';

import { fetchCollectionByCollectionId, fetchClaimsByCollectionId } from '@utils/claims';
import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';
import { getAdditionalInfo, getServiceEndpoint, cleanUrlString } from '@utils/url';
import { themeJson } from '@constants/surveyTheme';
import { secret } from '@utils/secrets';
import { getMatrixOpenIdToken } from '@utils/matrix';
import {
  resolveUserMatrixRoomId,
  fetchEncryptedSigningMnemonic,
  storeEncryptedSigningMnemonic,
  decryptSigningMnemonic,
  generateSigningMnemonic,
} from '@utils/signingMnemonic';
import { deriveEd25519KeyPairFromMnemonic, createVeramoAgent, signClaimCredential } from '@utils/veramo';
import { hasEd25519VerificationMethod, buildAddEd25519VerificationMsg } from '@utils/did';
import base58 from 'bs58';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { saveDraft, clearDraft } from '@store/slices/claimDraftsSlice';
import { toast } from 'react-toastify';

interface CollectionDetailProps {
  entityDid: string;
  collectionId: string;
}

export default function CollectionDetail({ entityDid, collectionId }: CollectionDetailProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authContext = useAuth();
  const { awaitCompletion } = useBackgroundSetup();
  const address = authContext.address!;
  const did = authContext.did!;
  const onSign = authContext.onSign;

  const draft = useAppSelector((state) => state.claimDrafts.byCollectionId[collectionId]);

  const [auths, setAuths] = useState<string[]>([]);
  const [authzLoading, setAuthzLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [surveyTemplate, setSurveyTemplate] = useState<string | undefined>();
  const [surveyMode, setSurveyMode] = useState<'bid' | 'claim' | 'view' | null>(null);
  const [surveyVisible, setSurveyVisible] = useState(false);
  const [surveyClosing, setSurveyClosing] = useState(false);
  const [viewClaimData, setViewClaimData] = useState<Record<string, any> | null>(null);
  const [viewClaimId, setViewClaimId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState<'hidden' | 'prompt'>('hidden');
  const [pinEncryptedMnemonic, setPinEncryptedMnemonic] = useState<string | undefined>();
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const claimCollectionIdRef = useRef<string>(collectionId);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authsRef = useRef<string[]>([]);
  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();
  const claimBotClientRef = useRef<ReturnType<typeof createMatrixClaimBotClient>>();
  const pinHandlerRef = useRef<{ resolve?: (pin: string) => void; reject?: (err: any) => void }>({});
  const surveyHasChangesRef = useRef(false);

  const { collections: protocolCollections } = useProtocolCollections(entityDid);
  const collection = protocolCollections.find((c) => c.collectionId === collectionId);

  const isExpired = !!collection?.endDate && new Date(collection.endDate).getTime() !== 0 && new Date(collection.endDate) < new Date();
  const hasStarted = !collection?.startDate || new Date(collection.startDate).getTime() === 0 || new Date(collection.startDate) <= new Date();
  const isCollectionOpen = hasStarted && !isExpired;

  function addAuth(auth: string) {
    if (authsRef.current.includes(auth)) return;
    authsRef.current.push(auth);
    setAuths((prev) => [...prev, auth]);
  }
  function removeAuth(auth: string) {
    if (!authsRef.current.includes(auth)) return;
    authsRef.current = authsRef.current.filter((a) => a !== auth);
    setAuths((prev) => prev.filter((a) => a !== auth));
  }

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (address && claimCollectionIdRef.current) {
      checkAuthz();
      fetchBids();
      fetchMyClaims();
    }
    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [address, collectionId]);

  useEffect(() => {
    if (surveyTemplate) {
      // @ts-ignore
      import('survey-core/defaultV2.min.css');
      // @ts-ignore
      import('survey-core/themes/borderless-dark');
    }
  }, [surveyTemplate]);

  async function checkAuthz() {
    try {
      const col = await fetchCollectionByCollectionId(claimCollectionIdRef.current);
      if (cancelledRef.current) return;
      if (col.admin === address) addAuth('admin');
      else removeAuth('admin');
      const queryClient = await createQueryClient(CHAIN_RPC_URL);
      const [granteeGrants, entity] = await Promise.all([
        queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address }),
        fetchProtocolEntity(col.entity),
      ]);
      if (cancelledRef.current) return;
      if (entity?.owner === address) addAuth('owner');
      else removeAuth('owner');
      const grants = granteeGrants.grants as GrantAuthorization[];
      const registry = createRegistry();
      const targetCollectionId = claimCollectionIdRef.current;

      function grantMatchesCollection(g: GrantAuthorization, typeUrl: string): boolean {
        if (g.authorization?.typeUrl !== typeUrl || g.granter !== col.admin) return false;
        try {
          const decoded = registry.decode(g.authorization);
          const constraints = decoded.constraints ?? [];
          if (constraints.length === 0) return true;
          return constraints.some((c: any) => c.collectionId === targetCollectionId);
        } catch {
          return false;
        }
      }

      const hasEval = grants?.find((g) => grantMatchesCollection(g, TRANSACTION_TYPES.EvaluateClaimAuthorization));
      if (hasEval) addAuth(TRANSACTION_TYPES.EvaluateClaimAuthorization);
      else removeAuth(TRANSACTION_TYPES.EvaluateClaimAuthorization);
      const hasSubmit = grants?.find((g) => grantMatchesCollection(g, TRANSACTION_TYPES.SubmitClaimAuthorization));
      if (hasSubmit) addAuth(TRANSACTION_TYPES.SubmitClaimAuthorization);
      else removeAuth(TRANSACTION_TYPES.SubmitClaimAuthorization);
    } catch {
      // silent fail
    } finally {
      if (!cancelledRef.current) {
        setAuthzLoading(false);
        timeoutRef.current = setTimeout(checkAuthz, 5000);
      }
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

  function requestPin(encryptedMnemonic?: string): Promise<string> {
    setPinEncryptedMnemonic(encryptedMnemonic);
    return new Promise((resolve, reject) => {
      pinHandlerRef.current = { resolve, reject };
      setPinMode('prompt');
    });
  }

  async function fetchBids() {
    try {
      setBidsLoading(true);
      await awaitCompletion();
      if (cancelledRef.current) return;
      const client = getBidBotClient();
      if (!client) {
        console.warn('[CollectionDetail] No Matrix access token available; skipping bid fetch');
        return;
      }
      const openIdToken = await getMatrixOpenIdToken();
      const response = await client.bid.v1beta1.queryBidsByDid(collectionId, did, openIdToken, did);
      setBids(response.data ?? []);
    } catch (err) {
      console.warn('[CollectionDetail] fetchBids error:', err);
    } finally {
      setBidsLoading(false);
    }
  }

  async function fetchMyClaims() {
    try {
      setClaimsLoading(true);
      const result = await fetchClaimsByCollectionId(collectionId, address);
      setClaims(result ?? []);
    } catch {
      // silent fail
    } finally {
      setClaimsLoading(false);
    }
  }

  async function handleApplyAsAgent() {
    try {
      setIsApplying(true);
      setFormError(null);
      const col = await fetchCollectionByCollectionId(collectionId);
      const protocolEntity = await fetchProtocolEntity(col.protocol);
      const endpoint = protocolEntity?.linkedResource?.find(
        (r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#bco') || r?.id?.includes('#vct'),
      );
      if (!endpoint?.serviceEndpoint) throw new Error('Application form not found');
      const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
      const formData = await getAdditionalInfo(url);
      setSurveyTemplate(JSON.stringify(formData));
      setSurveyMode('bid');
      surveyHasChangesRef.current = false;
      requestAnimationFrame(() => setSurveyVisible(true));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Something went wrong');
      toast.error(message || 'Something went wrong');
    } finally {
      setIsApplying(false);
    }
  }

  async function viewClaim(claim: any) {
    try {
      setFormError(null);
      const client = getClaimBotClient();
      const openIdToken = await getMatrixOpenIdToken();
      const response = await client!?.claim.v1beta1.queryClaim(collectionId, claim.claimId, openIdToken, did);
      let claimData: Record<string, any> = {};
      if (response) {
        let parsed = typeof response === 'string' ? JSON.parse(response) : response;
        // Unwrap .data if present (some SDK versions wrap the response)
        if (parsed?.data && !parsed?.credentialSubject)
          parsed = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
        // If the claim is a signed VerifiableCredential, extract the credentialSubject survey data
        if (parsed?.credentialSubject) {
          const { id, type, ...rest } = parsed.credentialSubject;
          claimData = rest;
        } else {
          claimData = parsed;
        }
      }
      const col = await fetchCollectionByCollectionId(collectionId);
      const protocolEntity = await fetchProtocolEntity(col.protocol);
      const endpoint = protocolEntity?.linkedResource?.find(
        (r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#vct'),
      );
      if (!endpoint?.serviceEndpoint) throw new Error('Claim form not found');
      const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
      const formData = await getAdditionalInfo(url);
      const template = JSON.stringify(formData);

      setViewClaimId(claim.claimId);
      setViewClaimData(claimData);
      setSurveyTemplate(template);
      setSurveyMode('view');
      surveyHasChangesRef.current = false;
      requestAnimationFrame(() => setSurveyVisible(true));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Something went wrong');
      toast.error(message || 'Something went wrong');
    }
  }

  async function openClaimSurvey(resumeDraft?: boolean) {
    try {
      setFormError(null);

      if (resumeDraft && draft) {
        setSurveyTemplate(draft.surveyTemplate);
        setSurveyMode(draft.surveyMode);
        surveyHasChangesRef.current = true;
        requestAnimationFrame(() => setSurveyVisible(true));
        return;
      }

      const col = await fetchCollectionByCollectionId(collectionId);
      const protocolEntity = await fetchProtocolEntity(col.protocol);
      const endpoint = protocolEntity?.linkedResource?.find(
        (r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#vct'),
      );
      if (!endpoint?.serviceEndpoint) throw new Error('Claim form not found');
      const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
      const formData = await getAdditionalInfo(url);
      const template = JSON.stringify(formData);
      setSurveyTemplate(template);
      setSurveyMode('claim');
      surveyHasChangesRef.current = false;
      requestAnimationFrame(() => setSurveyVisible(true));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Something went wrong');
      toast.error(message || 'Something went wrong');
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
      console.log('parsed survey template', parsed);
      const model = new Model(parsed?.question ?? parsed);
      model.applyTheme(themeJson);
      model.allowCompleteSurveyAutomatic = false;

      // View mode — read-only with pre-filled data
      if (surveyMode === 'view') {
        if (viewClaimData) model.data = viewClaimData;
        model.mode = 'display';
        model.showNavigationButtons = 'none' as any;
        return model;
      }

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
        try {
          await awaitCompletion();
          if (surveyMode === 'bid') {
            const client = getBidBotClient();
            const openIdToken = await getMatrixOpenIdToken();
            const response = await client!?.bid.v1beta1.submitBid(
              collectionId,
              JSON.stringify(sender.data),
              'SA',
              openIdToken,
              did,
            );
            if (!response.id) throw new Error('Failed to submit application');
          } else {
            const homeServerUrl = secret.baseUrl as string;
            const accessToken = secret.accessToken as string;

            // 1. Resolve Matrix room
            const roomId = await resolveUserMatrixRoomId(address, accessToken, homeServerUrl);

            // 2. Fetch encrypted signing mnemonic from room state
            const existingEncrypted = await fetchEncryptedSigningMnemonic(roomId, accessToken, homeServerUrl);

            // 3. Prompt for PIN
            const pin = await requestPin('pin-only');

            // 4. Decrypt or generate signing mnemonic
            let signingMnemonic: string;
            if (existingEncrypted) {
              signingMnemonic = decryptSigningMnemonic(existingEncrypted, pin);
              if (!signingMnemonic) throw new Error('Failed to decrypt signing mnemonic - incorrect PIN');
            } else {
              signingMnemonic = generateSigningMnemonic();
              await storeEncryptedSigningMnemonic(roomId, signingMnemonic, pin, accessToken, homeServerUrl);
            }

            // 5. Derive Ed25519 key pair
            const keyPair = deriveEd25519KeyPairFromMnemonic(signingMnemonic);
            const pubKeyBase58 = base58.encode(keyPair.publicKey);

            // 6. Register Ed25519 VM on IID if needed
            const hasVm = await hasEd25519VerificationMethod(did, pubKeyBase58);
            if (!hasVm) {
              const addVmMsg = buildAddEd25519VerificationMsg(did, keyPair.publicKey, address);
              await onSign([addVmMsg]);
            }

            // 7-8. Create Veramo agent and sign VC
            const agent = await createVeramoAgent(keyPair, did);
            const signedVC = await signClaimCredential(agent, did, sender.data);

            // 9. Save signed VC to claim bot
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

            // 10-11. Submit claim to blockchain
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
          // Success — clear draft and close
          dispatch(clearDraft(collectionId));
          sender.doComplete();
          doCloseSurvey();
          fetchBids();
          fetchMyClaims();
        } catch (err) {
          toast.error((err as Error).message);
          console.error('error', err);
          model.completeText = 'Try again';
          model.onCompleting.add(preventComplete);
        }
      }

      model.onCompleting.add(preventComplete);
      model.completeText = 'Submit';

      // Track value changes for draft saving
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

  function doCloseSurvey() {
    setSurveyClosing(true);
    setSurveyVisible(false);
    surveyHasChangesRef.current = false;
    setTimeout(() => {
      setSurveyTemplate(undefined);
      setSurveyMode(null);
      setViewClaimData(null);
      setViewClaimId(null);
      setSurveyClosing(false);
    }, 350);
  }

  function handleCloseSurvey() {
    if (surveyMode === 'view') {
      doCloseSurvey();
      return;
    }
    if (surveyHasChangesRef.current) {
      setCloseConfirmVisible(true);
    } else {
      doCloseSurvey();
    }
  }

  function handleConfirmSave() {
    // Draft is already saved via onValueChanged — just close
    setCloseConfirmVisible(false);
    doCloseSurvey();
  }

  function handleConfirmDiscard() {
    setCloseConfirmVisible(false);
    dispatch(clearDraft(collectionId));
    doCloseSurvey();
  }

  const isAgent = auths.includes(TRANSACTION_TYPES.SubmitClaimAuthorization);
  const hasPendingBid = !isAgent && bids.length > 0;
  const dataLoading = authzLoading || bidsLoading || claimsLoading;
  const showApplyButton = !dataLoading && !isAgent && !hasPendingBid && isCollectionOpen;
  const showNewClaimButton = !dataLoading && isAgent && isCollectionOpen;
  const hasDraft = !!draft && draft.surveyMode === 'claim';

  const collectionName = collection?.formName || `Collection ${collectionId}`;
  const submitted = collection?.count ?? 0;
  const approved = collection?.approved ?? 0;
  const quota = collection?.quota ?? 0;

  function statusLabel(claim: any): { text: string; color: string; bg: string } {
    const s = claim.evaluationByClaimId?.status;
    if (s === 1) return { text: 'Approved', color: '#2F6A59', bg: '#dcfce7' };
    if (s === 2) return { text: 'Rejected', color: '#991b1b', bg: '#fee2e2' };
    if (s === 3) return { text: 'Disputed', color: '#E49526', bg: '#fef3c7' };
    return { text: 'Pending', color: '#545859', bg: '#F3F6FA' };
  }

  return (
    <div style={{ overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <div
        style={{
          position: 'relative',
          transform: surveyVisible ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.35s ease-in-out',
          minHeight: '100vh',
        }}
      >
        <GradientBand {...GRADIENT_COLORS.collectionDetail} />
        <Header onGradient />
        <main
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 'var(--max-width)',
            margin: '0 auto',
            padding: '0 16px 16px',
            paddingTop: 'calc(var(--header-height) + 8px)',
            paddingBottom: showApplyButton || showNewClaimButton ? '80px' : '16px',
            minHeight: '100vh',
          }}
        >
          {/* Page title section */}
          <div
            style={{
              minHeight: '150px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => router.push(`/entities/${entityDid}`)}
              aria-label='Go back to claim collections'
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                margin: '0 0 6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '13px',
                fontWeight: 400,
                lineHeight: 1.2,
              }}
            >
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Claim Collections
            </button>
            <h1
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
              }}
            >
              {collectionName}
            </h1>
          </div>

          {/* Status banner for non-agents */}
          {dataLoading && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                padding: '32px 16px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</p>
            </div>
          )}

          {!dataLoading && !isAgent && !hasPendingBid && (
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Apply as a service agent to start submitting claims.
              </p>
            </div>
          )}

          {!dataLoading && hasPendingBid && (
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                Application pending
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your agent application is being reviewed.
              </p>
            </div>
          )}

          {/* Claims list */}
          {!dataLoading && isAgent && (
            <>
              {claims.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: '32px 16px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                    No claims yet. Submit your first claim to get started.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {claims.map((claim: any) => {
                    const status = statusLabel(claim);
                    return (
                      <div
                        key={claim.claimId}
                        onClick={() => viewClaim(claim)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '16px',
                          backgroundColor: 'var(--bg-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {claim.claimId?.slice(0, 25)}...
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {new Date(claim.submissionDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            color: status.color,
                            backgroundColor: status.bg,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {status.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {formError && (
            <p style={{ margin: '16px 0 0', fontSize: '13px', color: 'var(--error-color)', textAlign: 'center' }}>
              {formError}
            </p>
          )}
        </main>

        {/* Bottom action */}
        {!dataLoading && !isCollectionOpen && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              display: 'flex',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
              }}
            >
              {isExpired ? 'Collection has ended' : 'Collection has not started yet'}
            </p>
          </div>
        )}
        {(showApplyButton || showNewClaimButton) && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              zIndex: 2,
            }}
          >
            <button
              onClick={showApplyButton ? handleApplyAsAgent : () => openClaimSurvey(hasDraft)}
              disabled={isApplying}
              style={{
                width: '100%',
                maxWidth: 'var(--max-width)',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'var(--accent-color)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: isApplying ? 'default' : 'pointer',
                letterSpacing: '-0.2px',
                opacity: isApplying ? 0.5 : 1,
              }}
            >
              {showApplyButton
                ? isApplying
                  ? 'Loading...'
                  : 'Apply as Agent'
                : hasDraft
                ? 'Continue Claim'
                : 'New Claim'}
            </button>
          </div>
        )}
      </div>

      {/* PIN prompt overlay */}
      {pinMode === 'prompt' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '340px',
              margin: '0 20px',
              borderRadius: '12px',
              padding: '28px 24px',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
            }}
          >
            {/* @ts-ignore */}
            <MatrixPinForm
              encryptedMnemonic={pinEncryptedMnemonic}
              onSuccess={(pin: string) => {
                pinHandlerRef.current.resolve?.(pin);
                setPinMode('hidden');
              }}
              onError={(err: string) => {
                pinHandlerRef.current.reject?.(new Error(err));
                setPinMode('hidden');
              }}
            />
          </div>
        </div>
      )}

      {/* Survey slide-in */}
      {(surveyTemplate || surveyClosing) && survey && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            transform: surveyVisible ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.35s ease-in-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              height: 'var(--header-height)',
              gap: '4px',
            }}
          >
            <button
              onClick={handleCloseSurvey}
              aria-label='Close'
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
                <line x1='18' y1='6' x2='6' y2='18' />
                <line x1='6' y1='6' x2='18' y2='18' />
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
              {surveyMode === 'view'
                ? `Claim #${viewClaimId ?? ''}`
                : surveyMode === 'bid'
                ? 'Apply as Agent'
                : hasDraft
                ? 'Continue Claim'
                : 'New Claim'}
            </h3>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* @ts-ignore */}
            <Survey model={survey} />
          </div>
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
    </div>
  );
}
