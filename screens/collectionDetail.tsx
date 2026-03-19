import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createQueryClient, createRegistry, cosmos, ixo } from '@ixo/impactxclient-sdk';
import { createMatrixBidBotClient, createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';

import { fetchCollectionByCollectionId, fetchClaimsByCollectionId } from '@utils/claims';
import Header from '@components/Header/Header';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { useAuth } from '@hooks/useAuth';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';
import { getAdditionalInfo, getServiceEndpoint, cleanUrlString } from '@utils/url';
import { themeJson } from '@constants/surveyTheme';
import { secret } from '@utils/secrets';
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

  const claimCollectionIdRef = useRef<string>(collectionId);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authsRef = useRef<string[]>([]);
  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();
  const claimBotClientRef = useRef<ReturnType<typeof createMatrixClaimBotClient>>();
  const pinHandlerRef = useRef<{ resolve?: (pin: string) => void; reject?: (err: any) => void }>({});
  const surveyHasChangesRef = useRef(false);

  const { collections: protocolCollections } = useProtocolCollections(entityDid);
  const collection = protocolCollections.find((c) => c.collectionId === collectionId);

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
      import('survey-core/defaultV2.min.css');
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
    if (bidBotClientRef.current?.bid) return bidBotClientRef.current;
    bidBotClientRef.current = createMatrixBidBotClient({
      botUrl: process.env.NEXT_PUBLIC_MATRIX_BID_BOT_URL!,
      accessToken: secret.accessToken as string,
    });
    return bidBotClientRef.current;
  }

  function getClaimBotClient() {
    if (claimBotClientRef.current?.claim) return claimBotClientRef.current;
    claimBotClientRef.current = createMatrixClaimBotClient({
      botUrl: process.env.NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL!,
      accessToken: secret.accessToken as string,
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
      const client = getBidBotClient();
      const response = await client.bid.v1beta1.queryBidsByDid(collectionId, did);
      setBids(response.data ?? []);
    } catch {
      // silent fail
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
      setFormError(null);
      const col = await fetchCollectionByCollectionId(collectionId);
      const protocolEntity = await fetchProtocolEntity(col.protocol);
      const entities = ([] as any[]).concat(protocolEntity);
      const endpoint = entities
        .map((e: any) =>
          e?.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#bco')),
        )
        .find((r: any) => r?.serviceEndpoint);
      if (!endpoint?.serviceEndpoint) throw new Error('Application form not found');
      const entity = entities.find((e: any) =>
        e?.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#bco')),
      );
      const url = getServiceEndpoint(endpoint.serviceEndpoint, entity?.service);
      const formData = await getAdditionalInfo(url);
      setSurveyTemplate(JSON.stringify(formData));
      setSurveyMode('bid');
      surveyHasChangesRef.current = false;
      requestAnimationFrame(() => setSurveyVisible(true));
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function viewClaim(claim: any) {
    try {
      setFormError(null);
      const client = getClaimBotClient();
      const response = await client.claim.v1beta1.queryClaim(collectionId, claim.claimId);
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
      setFormError((err as Error).message);
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
      setFormError((err as Error).message);
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
    const parsed = JSON.parse(surveyTemplate);
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
        if (surveyMode === 'bid') {
          const client = getBidBotClient();
          const response = await client.bid.v1beta1.submitBid(collectionId, JSON.stringify(sender.data), 'SA');
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
          const col = await fetchCollectionByCollectionId(collectionId);
          const response = await client.claim.v1beta1.saveClaim(collectionId, JSON.stringify(signedVC));
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
  const showApplyButton = !dataLoading && !isAgent && !hasPendingBid;
  const showNewClaimButton = !dataLoading && isAgent;
  const hasDraft = !!draft && draft.surveyMode === 'claim';

  const collectionName = collection?.formName || `Collection ${collectionId}`;
  const submitted = collection?.count ?? 0;
  const approved = collection?.approved ?? 0;
  const quota = collection?.quota ?? 0;

  function statusLabel(claim: any): { text: string; color: string; bg: string } {
    const s = claim.evaluationByClaimId?.status;
    if (s === 1) return { text: 'Approved', color: '#166534', bg: '#dcfce7' };
    if (s === 2) return { text: 'Rejected', color: '#991b1b', bg: '#fee2e2' };
    if (s === 3) return { text: 'Disputed', color: '#92400e', bg: '#fef3c7' };
    return { text: 'Pending', color: '#854d0e', bg: '#fef9c3' };
  }

  return (
    <div style={{ overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <div
        style={{
          transform: surveyVisible ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.35s ease-in-out',
          minHeight: '100vh',
        }}
      >
        <Header onBack={() => router.push(`/entities/${entityDid}`)} />
        <main
          style={{
            maxWidth: 'var(--max-width)',
            margin: '0 auto',
            padding: '0 16px 16px',
            paddingTop: 'calc(var(--header-height) + 8px)',
            paddingBottom: showApplyButton || showNewClaimButton ? '80px' : '16px',
            minHeight: '100vh',
          }}
        >
          {/* Title */}
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--main-font-color)',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            {collectionName}
          </h1>

          {/* Subtle stats line */}
          {collection && (
            <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--muted-font-color)' }}>
              {quota ? `${submitted}/${quota}` : submitted} submitted
            </p>
          )}

          {/* Status banner for non-agents */}
          {dataLoading && (
            <p style={{ margin: '32px 0', fontSize: '14px', color: 'var(--muted-font-color)', textAlign: 'center' }}>
              Loading...
            </p>
          )}

          {!dataLoading && !isAgent && !hasPendingBid && (
            <div
              style={{
                margin: '32px 0',
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--card-bg-color)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-font-color)' }}>
                Apply as a service agent to start submitting claims.
              </p>
            </div>
          )}

          {!dataLoading && hasPendingBid && (
            <div
              style={{
                margin: '32px 0',
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--card-bg-color)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: 'var(--main-font-color)' }}>
                Application pending
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-font-color)' }}>
                Your agent application is being reviewed.
              </p>
            </div>
          )}

          {/* Claims list */}
          {!dataLoading && isAgent && (
            <>
              {claims.length === 0 ? (
                <p
                  style={{
                    margin: '32px 0',
                    fontSize: '14px',
                    color: 'var(--muted-font-color)',
                    textAlign: 'center',
                  }}
                >
                  No claims yet. Submit your first claim to get started.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {claims.map((claim: any, i: number) => {
                    const status = statusLabel(claim);
                    return (
                      <div
                        key={claim.claimId}
                        onClick={() => viewClaim(claim)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 0',
                          borderBottom: i < claims.length - 1 ? '1px solid var(--border-color)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--main-font-color)' }}>
                            {claim.claimId?.slice(0, 25)}...
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted-font-color)' }}>
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
            }}
          >
            <button
              onClick={showApplyButton ? handleApplyAsAgent : () => openClaimSurvey(hasDraft)}
              style={{
                width: '100%',
                maxWidth: 'var(--max-width)',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '-0.2px',
              }}
            >
              {showApplyButton ? 'Apply as Agent' : hasDraft ? 'Continue Claim' : 'New Claim'}
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
            backgroundColor: 'var(--form-bg-color)',
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
                color: 'var(--main-font-color)',
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
                color: 'var(--main-font-color)',
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
              backgroundColor: 'var(--surface-color)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--main-font-color)' }}>
                Unsaved changes
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-font-color)', lineHeight: 1.4 }}>
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
                  color: 'var(--primary-color)',
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
                  color: 'var(--muted-font-color)',
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
