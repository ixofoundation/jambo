import { CSSProperties, useEffect, useState } from 'react';

import useCollectionLinks, { LinkDirection, linkSavingKey } from '@hooks/useCollectionLinks';
import { ProtocolCollection, collectionName } from '@hooks/useProtocolCollections';

/**
 * Admin panel for one collection's base/sub links. "Base collections" are the
 * collections this one submits onto (this collection is their sub); "Sub
 * collections" are gated by this one. Add pickers only offer the entity's own
 * non-blacklisted collections (excluding self and already-linked ones) — the
 * worker additionally rejects cross-entity and reverse links.
 */
export default function CollectionLinkagesPanel({
  collection,
  allCollections,
  blacklist,
}: {
  collection: ProtocolCollection;
  allCollections: ProtocolCollection[];
  blacklist: Set<string>;
}) {
  const { base, sub, loading, error, savingKeys, addLink, removeLink, refresh } = useCollectionLinks(
    collection.collectionId,
  );

  const nameFor = (id: string): string | null => {
    const match = allCollections.find((c) => c.collectionId === id);
    return match ? collectionName(match) : null;
  };

  // Linked in either direction is ineligible for both pickers — the worker
  // rejects reverse (2-cycle) links anyway, so don't offer them.
  const linkedEitherWay = new Set([...base, ...sub]);
  const candidates = allCollections.filter(
    (c) =>
      c.collectionId !== collection.collectionId &&
      !blacklist.has(c.collectionId) &&
      !linkedEitherWay.has(c.collectionId),
  );

  if (loading) {
    return (
      <div style={panelStyle}>
        <span style={mutedTextStyle}>Loading links…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={panelStyle}>
        <span style={{ ...mutedTextStyle, color: 'var(--error-color)' }}>{error}</span>
        <button type='button' onClick={() => void refresh()} style={{ ...confirmButtonStyle, alignSelf: 'flex-start' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <LinkSection
        title='Base collections'
        hint='This collection can only be submitted against approved claims from these collections.'
        direction='base'
        linkedIds={base}
        candidates={candidates}
        nameFor={nameFor}
        savingKeys={savingKeys}
        onAdd={(id) => addLink('base', id)}
        onRemove={(id) => void removeLink('base', id)}
      />
      <LinkSection
        title='Sub collections'
        hint='Claims in these collections must reference an approved claim from this collection.'
        direction='sub'
        linkedIds={sub}
        candidates={candidates}
        nameFor={nameFor}
        savingKeys={savingKeys}
        onAdd={(id) => addLink('sub', id)}
        onRemove={(id) => void removeLink('sub', id)}
      />
    </div>
  );
}

function LinkSection({
  title,
  hint,
  direction,
  linkedIds,
  candidates,
  nameFor,
  savingKeys,
  onAdd,
  onRemove,
}: {
  title: string;
  hint: string;
  direction: LinkDirection;
  linkedIds: string[];
  candidates: ProtocolCollection[];
  nameFor: (id: string) => string | null;
  savingKeys: Set<string>;
  onAdd: (id: string) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [selected, setSelected] = useState('');
  // The selection is only cleared once the add resolves, so this stays truthy
  // (and the button disabled) for the whole in-flight request.
  const adding = !!selected && savingKeys.has(linkSavingKey(direction, selected));

  // Candidates can shrink while the panel is open (e.g. a collection gets
  // blacklisted or linked in the other section) — drop a selection that is no
  // longer offered so Add can't submit an excluded collection.
  useEffect(() => {
    if (selected && !candidates.some((c) => c.collectionId === selected)) {
      setSelected('');
    }
  }, [selected, candidates]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      <span style={mutedTextStyle}>{hint}</span>

      {linkedIds.length === 0 ? (
        <span style={mutedTextStyle}>No links yet.</span>
      ) : (
        linkedIds.map((id) => (
          <LinkedRow
            key={id}
            id={id}
            name={nameFor(id)}
            saving={savingKeys.has(linkSavingKey(direction, id))}
            onRemove={() => onRemove(id)}
          />
        ))
      )}

      {candidates.length === 0 ? (
        <span style={mutedTextStyle}>No eligible collections to link.</span>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
          <select
            disabled={adding}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label={`Add ${title.toLowerCase().replace(/s$/, '')}`}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 8px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary, transparent)',
              color: 'var(--text-primary)',
            }}
          >
            <option value=''>Select a collection…</option>
            {candidates.map((c) => (
              <option key={c.collectionId} value={c.collectionId}>
                {`${collectionName(c)} (${c.collectionId})`}
              </option>
            ))}
          </select>
          <button
            type='button'
            disabled={!selected || adding}
            onClick={() => {
              if (!selected || adding) return;
              void onAdd(selected).then(() => setSelected(''));
            }}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              background: 'var(--green-primary)',
              color: '#fff',
              cursor: !selected || adding ? 'default' : 'pointer',
              opacity: !selected || adding ? 0.5 : 1,
            }}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}

// Row for an existing link: id chip + resolved name, remove button with an
// inline confirm strip (matches the admin screens' no-modal convention).
function LinkedRow({
  id,
  name,
  saving,
  onRemove,
}: {
  id: string;
  name: string | null;
  saving: boolean;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '8px',
        background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
      }}
    >
      <span title={`Collection ${id}`} style={chipStyle}>
        {id}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '12px',
          color: name ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name ?? 'Not in this entity'}
      </span>

      {saving ? (
        <span
          aria-hidden='true'
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid var(--text-secondary)',
            borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      ) : confirming ? (
        <>
          <button
            type='button'
            onClick={() => {
              setConfirming(false);
              onRemove();
            }}
            style={{ ...confirmButtonStyle, color: 'var(--error-color)' }}
          >
            Remove
          </button>
          <button type='button' onClick={() => setConfirming(false)} style={confirmButtonStyle}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type='button'
          aria-label={`Remove link to collection ${id}`}
          onClick={() => setConfirming(true)}
          style={{ ...confirmButtonStyle, color: 'var(--text-secondary)' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  padding: '12px 14px 14px 40px',
  borderTop: '1px solid var(--border-color)',
  background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
};

const mutedTextStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
};

const chipStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: '10px',
  fontWeight: 500,
  fontFamily: 'var(--font-mono, monospace)',
  color: 'color-mix(in srgb, var(--text-primary) 65%, transparent)',
  background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
  borderRadius: '9999px',
  padding: '2px 8px',
  maxWidth: '40%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const confirmButtonStyle: CSSProperties = {
  flexShrink: 0,
  padding: '4px 8px',
  fontSize: '11px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'transparent',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};
