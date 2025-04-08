import { useState } from 'react';
import UserSelectModal from './UserSelectModal';

const BID_BOT_URL = 'http://localhost:8084';
const CLAIM_BOT_URL = 'http://localhost:8083';
const ROOM_BOT_URL = 'http://localhost:8088';
const USERS = [
  {
    name: 'admin',
    tag: 'Matrix Admin',
    collections: [],
    did: '',
    address: '',
    userId: '@admin:localhost:8408',
    roomAlias: '',
    roomAliasFull: '',
    roomId: '',
    accessToken: 'syt_YWRtaW4_OZZeluhDgMwkwUDFMDPN_3aSQy5',
  },
  {
    name: 'tester',
    tag: 'Owner & Authz Evaluate Claim',
    collections: ['1'],
    did: 'did:ixo:ixo1n8yrmeatsk74dw0zs95ess9sgzptd6thgjgcj2',
    address: 'ixo1n8yrmeatsk74dw0zs95ess9sgzptd6thgjgcj2',
    userId: '@did-ixo-ixo1n8yrmeatsk74dw0zs95ess9sgzptd6thgjgcj2:localhost:8408',
    roomAlias: 'did-ixo-ixo1n8yrmeatsk74dw0zs95ess9sgzptd6thgjgcj2',
    roomAliasFull: '#did-ixo-ixo1n8yrmeatsk74dw0zs95ess9sgzptd6thgjgcj2:localhost:8408',
    roomId: '!UCdiEVjbArhkfiMIgg:localhost:8408',
    accessToken: 'syt_ZGlkLWl4by1peG8xbjh5cm1lYXRzazc0ZHcwenM5NWVzczlzZ3pwdGQ2dGhnamdjajI_fGbIMgiGpKgyyFuioRej_2ohIdb',
  },
  {
    name: 'alice',
    tag: 'Authz Submit Claim',
    collections: [],
    did: 'did:ixo:ixo12am7v5xgjh72c7xujreyvtncqwue3w0v6ud3r4',
    address: 'ixo12am7v5xgjh72c7xujreyvtncqwue3w0v6ud3r4',
    userId: '@did-ixo-ixo12am7v5xgjh72c7xujreyvtncqwue3w0v6ud3r4:localhost:8408',
    roomAlias: 'did-ixo-ixo12am7v5xgjh72c7xujreyvtncqwue3w0v6ud3r4',
    roomAliasFull: '#did-ixo-ixo12am7v5xgjh72c7xujreyvtncqwue3w0v6ud3r4:localhost:8408',
    roomId: '!hsjnfmctJfYoGHPWTf:localhost:8408',
    accessToken: 'syt_ZGlkLWl4by1peG8xMmFtN3Y1eGdqaDcyYzd4dWpyZXl2dG5jcXd1ZTN3MHY2dWQzcjQ_BSIUbCjgvaaUmKwSrjFV_2LEqK2',
  },
  {
    name: 'bob',
    tag: 'Authz Submit Claim & Authz Evaluate Claim',
    collections: [],
    did: 'did:ixo:ixo13dy867pyn8jda82vnshy7jjjv42n69k7497jrh',
    address: 'ixo13dy867pyn8jda82vnshy7jjjv42n69k7497jrh',
    userId: '@did-ixo-ixo13dy867pyn8jda82vnshy7jjjv42n69k7497jrh:localhost:8408',
    roomAlias: 'did-ixo-ixo13dy867pyn8jda82vnshy7jjjv42n69k7497jrh',
    roomAliasFull: '#did-ixo-ixo13dy867pyn8jda82vnshy7jjjv42n69k7497jrh:localhost:8408',
    roomId: '!cjDJVRgnfVWVgTXJfr:localhost:8408',
    accessToken: 'syt_ZGlkLWl4by1peG8xM2R5ODY3cHluOGpkYTgydm5zaHk3ampqdjQybjY5azc0OTdqcmg_TkDvCxVYgYIbVfqlHCho_08iWO6',
  },
  {
    name: 'charlie',
    tag: '',
    collections: [],
    did: 'did:ixo:ixo16vw0mreudhe39z5sr7ldk6jqtfdz4lmentrl4x',
    address: 'ixo16vw0mreudhe39z5sr7ldk6jqtfdz4lmentrl4x',
    userId: '@did-ixo-ixo16vw0mreudhe39z5sr7ldk6jqtfdz4lmentrl4x:localhost:8408',
    roomAlias: 'did-ixo-ixo16vw0mreudhe39z5sr7ldk6jqtfdz4lmentrl4x',
    roomAliasFull: '#did-ixo-ixo16vw0mreudhe39z5sr7ldk6jqtfdz4lmentrl4x:localhost:8408',
    roomId: '!HpzrpqDfXDJDAquhmB:localhost:8408',
    accessToken: 'syt_ZGlkLWl4by1peG8xNnZ3MG1yZXVkaGUzOXo1c3I3bGRrNmpxdGZkejRsbWVudHJsNHg_zsfDCQhQdrkVcZlZvUDF_4WTdR4',
  },
];

type User = (typeof USERS)[number];
type Tab = 'bids' | 'status' | 'claims';

type ActionType =
  | 'queryBids'
  | 'queryBidsByDid'
  | 'submitBid'
  | 'approveBid'
  | 'rejectBid'
  | 'checkStatus'
  | 'blockDid'
  | 'unblockDid'
  | 'getClaim'
  | 'saveClaim';

interface BidTesterProps {
  homeServerUrl: string;
  accessToken: string;
  adminAccessToken: string;
}

interface Bid {
  id: string;
  did: string;
  collection: string;
  type: string;
  address: string;
  data: string;
  role: string;
  created: string;
}

const BidTester = ({ homeServerUrl }: BidTesterProps) => {
  const [collectionId, setCollectionId] = useState('1');
  const [did, setDid] = useState('did:ixo:ixo1234567890');
  const [address, setAddress] = useState('ixo1234567890');
  const [bidValue, setBidValue] = useState('{"greet":"hi","did":"<did>"}');
  const [role, setRole] = useState('SA');
  const [result, setResult] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('bids');
  const [showUserModal, setShowUserModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [actionParams, setActionParams] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<string>('');
  const [claim, setClaim] = useState<string>('{"greet":"hi","did":"<did>"}');
  const [cid, setCid] = useState<string>('bafkreiftnm5opugphgnta77ksoosp5kv62khmlootxksv7llkfb76rd7vq');
  const [claimByCid, setClaimByCid] = useState<any>();
  const [selectedUser, setSelectedUser] = useState<User>(USERS[1]); // Default to 'tester'

  // useEffect(() => {
  //   handleSourceRoomAndJoin(USERS.find((u) => u.name === 'tester'));
  // }, [roomId]);

  const handleSourceRoomAndJoin = async (user: User) => {
    console.log('handleSourceRoomAndJoin', user, did);
    try {
      const response = await fetch('/api/bids/sourceRoomAndJoin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          did: 'did:ixo:entity:61392c571ef644d54d77e4daf611bf89',
          accessToken: user.accessToken,
          homeServerUrl,
          botUrl: ROOM_BOT_URL,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
    }
  };

  const handleQueryBids = async () => {
    console.log('handleQueryBids', collectionId, did);
    try {
      const response = await fetch('/api/bids/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          pagination: {},
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setBids(data.data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
      setBids([]);
    }
  };

  const handleQueryBidByDid = async () => {
    const target = USERS.find((u) => u.name === targetUser) ?? selectedUser;
    console.log('handleQueryBidByDid', collectionId, did);
    try {
      const response = await fetch('/api/bids/queryDid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          did: target.did,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
      setBids(data.data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
      setBids([]);
    }
  };

  const handleSubmitBid = async () => {
    let bid = bidValue.replace('<did>', selectedUser.did);
    console.log('handleSubmitBid', collectionId, did, address, bid, role);
    try {
      const response = await fetch('/api/bids/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          did: selectedUser.did,
          address: selectedUser.address,
          bid: bid,
          role,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
    }
  };

  const handleApproveBid = async (bidId: string) => {
    console.log('handleApproveBid', collectionId, bidId);
    try {
      const bid = bids?.find((b) => b?.id === bidId);
      if (!bid) {
        throw new Error('Bid not found');
      }
      const response = await fetch('/api/bids/approveBid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: bid.collection,
          did: bid.did,
          bidId: bid.id,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
    } finally {
      setBids([]);
    }
  };

  const handleRejectBid = async (bidId: string) => {
    console.log('handleRejectBid', collectionId, bidId);
    try {
      const bid = bids?.find((b) => b?.id === bidId);
      if (!bid) {
        throw new Error('Bid not found');
      }
      const response = await fetch('/api/bids/rejectBid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: bid.collection,
          did: bid.did,
          bidId: bid.id,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
    } finally {
      setBids([]);
    }
  };

  const handleIsBlocked = async () => {
    const target = USERS.find((u) => u.name === targetUser) ?? selectedUser;
    console.log('handleIsBlocked', collectionId, did);
    try {
      const response = await fetch('/api/bids/isBlocked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          did: target.did,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setIsBlocked(data.blocked);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setIsBlocked(null);
      setResult((error as Error).message);
    }
  };

  const handleBlock = async () => {
    const target = USERS.find((u) => u.name === targetUser) ?? selectedUser;
    console.log('handleBlock', collectionId, did);
    try {
      const response = await fetch('/api/bids/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          did: target.did,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
    }
  };

  const handleUnblock = async () => {
    const target = USERS.find((u) => u.name === targetUser) ?? selectedUser;
    console.log('handleUnblock', collectionId, did);
    try {
      const response = await fetch('/api/bids/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          did: target.did,
          botUrl: BID_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.log('error', error);
      setResult((error as Error).message);
    }
  };

  const handleSaveClaim = async () => {
    const claimData = claim.replace('<did>', selectedUser.did);
    console.log('handleSaveClaim', collectionId, did, address, claimData);
    try {
      const response = await fetch('/api/bids/saveClaim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          did: selectedUser.did,
          address: selectedUser.address,
          claim: claimData,
          botUrl: CLAIM_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setResult(data);
    } catch (error) {
      console.error('error', error);
      setResult((error as Error).message);
    }
  };

  const handleGetClaim = async () => {
    console.log('handleGetClaim', collectionId, cid);
    try {
      const response = await fetch('/api/bids/getClaim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId,
          cid,
          botUrl: CLAIM_BOT_URL,
          accessToken: selectedUser.accessToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => 'unknown error');
        throw new Error(`ERROR: ${data.message}`);
      }

      const data = await response.json();
      console.log('response', data);
      setClaimByCid(data.data);
      setResult(data);
    } catch (error) {
      setClaimByCid(undefined);
      setResult((error as Error).message);
      console.error('error', error);
    }
  };

  const handleUserSelect = (user: User) => {
    setTargetUser(user.name);
    setSelectedUser(user);
    setDid(user.did);
    setAddress(user.address);
    setShowUserModal(false);
  };

  const BidCard = ({ bid }: { bid: Bid }) => {
    const isExpanded = expandedBidId === bid.id;

    return (
      <div className='bid-card'>
        <div className='bid-header' onClick={() => setExpandedBidId(isExpanded ? null : bid.id)}>
          <div className='bid-summary'>
            <span className='bid-id'>ID: {bid.id.slice(0, 8)}...</span>
            <span className='bid-role'>User: {USERS.find((u) => u.did === bid.did)?.name}</span>
            <span className='bid-role'>Role: {bid.role}</span>
          </div>
          <div className='bid-actions'>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApproveBid(bid.id);
              }}
            >
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRejectBid(bid.id);
              }}
            >
              Reject
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className='bid-details'>
            <pre>{JSON.stringify(bid, null, 2)}</pre>
          </div>
        )}
        <style jsx>{`
          .bid-card {
            border: 1px solid #dee2e6;
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
          }
          .bid-header {
            padding: 15px;
            background: #f8f9fa;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .bid-header:hover {
            background: #e9ecef;
          }
          .bid-summary {
            display: flex;
            gap: 20px;
            align-items: center;
          }
          .bid-id {
            font-family: monospace;
            font-size: 0.8em;
          }
          .bid-date {
            color: #666;
            font-size: 0.5em;
          }
          .bid-role {
            font-weight: bold;
          }
          .bid-actions {
            display: flex;
            gap: 10px;
          }
          .bid-actions button {
            padding: 4px 8px;
            font-size: 0.9em;
          }
          .bid-details {
            padding: 15px;
            background: white;
            border-top: 1px solid #dee2e6;
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className='bid-tester'>
      <h2>Bid Tester</h2>

      <div className='input-section'>
        <h3>Configuration</h3>
        <div className='input-grid'>
          <div className='input-field'>
            <label htmlFor='collectionId'>Collection ID</label>
            <input
              id='collectionId'
              type='text'
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            />
          </div>
          <div className='input-field'>
            <label>Selected User</label>
            <div className='user-selector' onClick={() => setShowUserModal(true)}>
              <div className='user-info'>
                <span className='user-name'>{selectedUser.name}</span>
                <span className='user-tag'>{selectedUser.tag}</span>
              </div>
              <button className='change-user-btn'>👤</button>
            </div>
          </div>
        </div>
      </div>

      <div className='tabs-container'>
        <div className='tabs'>
          <button
            className={`tab ${activeTab === 'bids' ? 'active' : ''}`}
            onClick={() => {
              setResult(null);
              setBids([]);
              setIsBlocked(null);
              setClaimByCid(null);
              setActiveTab('bids');
            }}
          >
            Bids
          </button>
          <button
            className={`tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => {
              setResult(null);
              setBids([]);
              setIsBlocked(null);
              setClaimByCid(null);
              setActiveTab('status');
            }}
          >
            Status
          </button>
          <button
            className={`tab ${activeTab === 'claims' ? 'active' : ''}`}
            onClick={() => {
              setResult(null);
              setBids([]);
              setIsBlocked(null);
              setClaimByCid(null);
              setActiveTab('claims');
            }}
          >
            Claims
          </button>
        </div>

        <div className='tab-content'>
          {activeTab === 'bids' && (
            <>
              <div className='bids-section'>
                <h3>Bids List</h3>
                <div className='query-actions'>
                  <button onClick={handleQueryBids}>Query Bids</button>
                  <div className='user-query-group'>
                    <select value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className='user-select'>
                      <option value=''>Select user to query</option>
                      {USERS.map((user) => (
                        <option key={user.name} value={user.name}>
                          {user.name} ({user.tag || ''})
                        </option>
                      ))}
                    </select>
                    <button onClick={handleQueryBidByDid}>Query Bids By DID</button>
                  </div>
                </div>

                <div className='bids-list'>
                  {bids.length === 0 ? (
                    <div className='no-bids'>No bids found</div>
                  ) : (
                    bids.map((bid) => <BidCard key={bid.id} bid={bid} />)
                  )}
                </div>
              </div>

              <div className='input-section'>
                <h3>Submit Bid</h3>
                <div className='input-grid'>
                  <div className='input-field'>
                    <label htmlFor='bidValue'>Bid Value</label>
                    <input type='text' id='bidValue' value={bidValue} onChange={(e) => setBidValue(e.target.value)} />
                  </div>
                  <div className='input-field'>
                    <label htmlFor='role'>Role</label>
                    <input type='text' id='role' value={role} onChange={(e) => setRole(e.target.value)} />
                  </div>
                  <div className='button-field'>
                    <button onClick={handleSubmitBid}>Submit Bid</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'status' && (
            <div className='block-status'>
              <div className='status-indicator'>
                {USERS.find((u) => u.name === targetUser)?.name ?? selectedUser.name ?? 'Unknown User'}'s Status:{' '}
                {isBlocked === null ? 'Unknown' : isBlocked ? 'Blocked 🚫' : 'Not Blocked ✅'}
              </div>
              <div className='block-actions'>
                <div className='input-field'>
                  <label htmlFor='targetUser'>Target User</label>
                  <select
                    id='targetUser'
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    className='user-select'
                  >
                    {USERS.map((user) => (
                      <option key={user.name} value={user.name}>
                        {user.name} ({user.tag || 'no tag'})
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleIsBlocked}>Check Status</button>
                <button onClick={handleBlock}>Block DID</button>
                <button onClick={handleUnblock}>Unblock DID</button>
              </div>
            </div>
          )}

          {activeTab === 'claims' && (
            <>
              <div className='claims-section'>
                <h3>Get Claim</h3>
                <div className='input-grid'>
                  <div className='input-field'>
                    <label htmlFor='cid'>CID</label>
                    <input
                      type='text'
                      id='cid'
                      value={cid}
                      onChange={(e) => setCid(e.target.value)}
                      placeholder='Enter claim ID'
                    />
                  </div>
                  <div className='button-field'>
                    <button onClick={handleGetClaim}>Get Claim</button>
                  </div>
                </div>
                {claimByCid && (
                  <div className='claim-result'>
                    <h4>Claim Data:</h4>
                    <pre>{JSON.stringify(claimByCid, null, 2)}</pre>
                  </div>
                )}
              </div>

              <div className='claims-section'>
                <h3>Save Claim</h3>
                <div className='input-grid'>
                  <div className='input-field'>
                    <label htmlFor='claim'>Claim Data</label>
                    <textarea
                      id='claim'
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      placeholder='Enter claim data (JSON)'
                      rows={4}
                    />
                  </div>
                  <div className='button-field'>
                    <button onClick={handleSaveClaim}>Save Claim</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className='result'>
        <h3>Result:</h3>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>

      {showUserModal && (
        <UserSelectModal
          users={USERS}
          // @ts-ignore
          onSelect={handleUserSelect}
          onClose={() => {
            setShowUserModal(false);
            setCurrentAction(null);
            setActionParams(null);
          }}
          action={currentAction ?? ''}
        />
      )}

      <style jsx>{`
        .bid-tester {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .input-section {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          border: 1px solid #dee2e6;
        }
        .input-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }
        .input-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        .input-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .input-field label {
          font-size: 0.9em;
          color: #666;
          font-weight: 500;
        }
        .input-field input {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 0.9em;
          width: 100%;
        }
        .input-field input:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.1);
        }
        .block-status {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          border: 1px solid #dee2e6;
        }
        .status-indicator {
          font-size: 1.1em;
          margin-bottom: 10px;
          font-weight: bold;
        }
        .block-actions {
          display: flex;
          gap: 10px;
        }
        .button-group {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
        }
        input {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          padding: 8px 16px;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background: #0051a2;
        }
        .result {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .bids-section {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          border: 1px solid #dee2e6;
        }
        .bids-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }
        .query-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          align-items: center;
        }
        .no-bids {
          text-align: center;
          padding: 20px;
          color: #666;
          font-style: italic;
        }
        .bids-list {
          max-height: 500px;
          overflow-y: auto;
        }
        .tabs-container {
          margin-bottom: 20px;
        }
        .tabs {
          display: flex;
          gap: 2px;
          margin-bottom: 20px;
          border-bottom: 1px solid #dee2e6;
        }
        .tab {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-bottom: none;
          border-radius: 4px 4px 0 0;
          cursor: pointer;
          color: #666;
          font-weight: 500;
        }
        .tab:hover {
          background: #e9ecef;
        }
        .tab.active {
          background: white;
          color: #0070f3;
          border-bottom: 2px solid #0070f3;
          margin-bottom: -1px;
        }
        .tab-content {
          background: white;
          min-height: 200px;
        }
        .claims-section {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          border: 1px solid #dee2e6;
        }
        .claims-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }
        .claim-result {
          margin-top: 15px;
          padding: 15px;
          background: #fff;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }
        .claim-result h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #666;
        }
        textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
          resize: vertical;
        }
        textarea:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.1);
        }
        .button-field {
          display: flex;
          align-items: flex-end;
        }
        .button-field button {
          margin-top: 23px;
        }
        .user-selector {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
          background: white;
          transition: all 0.2s;
        }
        .user-selector:hover {
          border-color: #0070f3;
          background: #f8f9fa;
        }
        .user-info {
          display: flex;
          flex-direction: column;
        }
        .user-name {
          font-weight: 500;
          text-transform: capitalize;
        }
        .user-tag {
          font-size: 0.8em;
          color: #666;
        }
        .change-user-btn {
          background: none;
          border: none;
          padding: 0;
          font-size: 1.2em;
          cursor: pointer;
          color: #0070f3;
        }
        .change-user-btn:hover {
          transform: scale(1.1);
        }
        .user-select {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 0.9em;
          width: 100%;
          background: white;
          cursor: pointer;
        }
        .user-select:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.1);
        }
        .user-select option {
          padding: 8px;
        }
        .user-query-group {
          display: flex;
          gap: 10px;
          flex: 1;
        }

        .user-query-group .user-select {
          flex: 1;
          min-width: 200px;
        }

        .query-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          align-items: center;
        }
      `}</style>
    </div>
  );
};

export default BidTester;
