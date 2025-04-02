interface User {
  name: string;
  collections: string[];
  tag: string;
  did: string;
  address: string;
  userId: string;
  roomAlias: string;
  roomAliasFull: string;
  roomId: string;
  accessToken: string;
}

interface UserSelectModalProps {
  users: Array<User>;
  onSelect: (user: User) => void;
  onClose: () => void;
  action: string;
}

const UserSelectModal = ({ users, onSelect, onClose, action }: UserSelectModalProps) => {
  return (
    <>
      <div className='modal-overlay'>
        <div className='modal'>
          <div className='modal-header'>
            <h3>Select User for: {action}</h3>
            <button className='close-button' onClick={onClose}>
              ×
            </button>
          </div>
          <div className='users-list'>
            {(users ?? []).map((user) => (
              <div key={user.name} className='user-card' onClick={() => onSelect(user)}>
                <div className='user-name'>
                  {user.name} ({user.tag})
                </div>
                <div className='user-details'>
                  <div className='user-did'>did: {user.did ? user.did : 'No DID'}</div>
                  <div className='user-id'>user id: {user.userId}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 8px;
          padding: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
          z-index: 1001;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dee2e6;
        }
        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          color: #666;
        }
        .users-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .user-card {
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .user-card:hover {
          background: #f8f9fa;
          border-color: #0070f3;
        }
        .user-name {
          font-weight: bold;
          font-size: 1.1em;
          margin-bottom: 6px;
          color: #0070f3;
          text-transform: capitalize;
        }
        .user-details {
          font-size: 0.9em;
          color: #666;
        }
        .user-did,
        .user-id {
          margin-bottom: 4px;
          font-family: monospace;
          font-size: 0.8em;
        }
      `}</style>
    </>
  );
};

export default UserSelectModal;
