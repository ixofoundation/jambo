import type { CSSProperties } from 'react';

export const overlayCardStyle: CSSProperties = {
  padding: '0',
  width: '100%',
  maxWidth: '480px',
};

export const inlineAlertStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  margin: '0 0 16px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--warning-border, #e2b04a)',
  backgroundColor: 'var(--warning-bg, rgba(255, 196, 0, 0.10))',
  fontSize: '12px',
  lineHeight: 1.4,
  color: 'var(--text-primary)',
};

export const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-secondary, #777)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export const quickMessageButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  marginBottom: '6px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary, transparent)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  lineHeight: 1.4,
  cursor: 'pointer',
};

export const threadEntryButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  marginBottom: '6px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary, transparent)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  lineHeight: 1.4,
  cursor: 'pointer',
};

export const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '72px',
  resize: 'vertical',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  fontSize: '14px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export const messageRowStyle: CSSProperties = {
  padding: '12px 4px',
};

// Bottom border of each message row provides the divider between consecutive messages
// (skipped on the last row in each list).
export const messageBottomDividerStyle: CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
};

// Wraps the entire replies group so the accent line runs as one continuous vertical line
// down the left of all replies instead of being repeated per row.
export const threadRepliesContainerStyle: CSSProperties = {
  borderLeft: '2px solid var(--border-color)',
  paddingLeft: '12px',
};

export const inputRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-end',
};

export const sendIconButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  width: '44px',
  height: '44px',
  borderRadius: '10px',
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

export const messageMetaRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: 'var(--text-secondary, #777)',
  marginBottom: '4px',
};

export const messageBodyStyle: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
};
