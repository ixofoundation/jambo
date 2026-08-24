import type { CSSProperties } from 'react';

export const inlineAlertStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  margin: '0 0 16px',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid var(--warning-border)',
  backgroundColor: '#fdeed8',
  fontSize: '13px',
  lineHeight: 1.5,
  color: 'var(--text-primary)',
};

export const sectionTitleStyle: CSSProperties = {
  margin: '0 0 10px',
  fontFamily: 'var(--font-display)',
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--text-primary)',
};

// Container that wraps a list of conversation rows into a single grouped card.
export const conversationListBoxStyle: CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--shadow-soft)',
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
  padding: '14px 16px',
  border: 'none',
  borderBottom: '1px solid var(--border-color)',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  fontSize: '15px',
  lineHeight: 1.4,
  cursor: 'pointer',
  textAlign: 'left',
};

export const conversationListChevronStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--text-secondary)',
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
  padding: '10px 0',
  fontSize: '16px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  overflowY: 'auto',
};

export const inputRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-end',
  backgroundColor: 'var(--surface-inset)',
  border: '1.5px solid var(--border-color)',
  borderRadius: '999px',
  padding: '4px 4px 4px 16px',
};

export const sendIconButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'var(--green-primary)',
  color: '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const sendIconButtonDisabledStyle: CSSProperties = {
  ...sendIconButtonStyle,
  cursor: 'not-allowed',
  opacity: 0.45,
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

