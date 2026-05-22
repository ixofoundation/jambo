import type { CSSProperties } from 'react';

export const inlineAlertStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  margin: '0 0 16px',
  padding: '10px 12px',
  borderRadius: '10px',
  borderLeft: '5px solid var(--warning-border, #e2b04a)',
  backgroundColor: 'var(--bg-secondary)',
  fontSize: '12px',
  lineHeight: 1.4,
  color: 'var(--text-primary)',
};

export const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '1.1rem',
  fontWeight: 500,
  color: 'var(--text-primary)',
};

// Container that wraps a list of conversation rows into a single grouped card.
export const conversationListBoxStyle: CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '12px',
  overflow: 'hidden',
};

// A single conversation row inside `conversationListBoxStyle`. Rows are separated by a divider
// at the bottom; the last row in a list should override `borderBottom` to `none`.
export const conversationListRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  width: '100%',
  padding: '12px 14px',
  border: 'none',
  borderBottom: '1px solid var(--border-color)',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  fontSize: '13px',
  lineHeight: 1.4,
  cursor: 'pointer',
  textAlign: 'left',
};

export const conversationListChevronStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--text-secondary, #777)',
  display: 'inline-flex',
  alignItems: 'center',
};

export const textareaStyle: CSSProperties = {
  width: '100%',
  resize: 'none',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  padding: '8px 4px',
  fontSize: '14px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  overflowY: 'auto',
};

export const inputRowStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  alignItems: 'flex-end',
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '12px',
  padding: '4px 4px 4px 10px',
};

export const sendIconButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: 'var(--accent-color, #3b82f6)',
  color: 'white',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const sendIconButtonDisabledStyle: CSSProperties = {
  ...sendIconButtonStyle,
  cursor: 'not-allowed',
  opacity: 0.5,
};

export const backChevronButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  width: 28,
  height: 28,
  borderRadius: 6,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

