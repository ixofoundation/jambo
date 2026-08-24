import { useCallback, useLayoutEffect, useRef } from 'react';

import { SendIcon } from '../icons';
import {
  inputRowStyle,
  sendIconButtonDisabledStyle,
  sendIconButtonStyle,
  textareaStyle,
} from '../styles';

type ChatInputProps = {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  placeholder: string;
  sendAriaLabel: string;
  sending: boolean;
  autoFocus?: boolean;
  footerNote?: string;
};

const MAX_VISIBLE_ROWS = 3;

export default function ChatInput({
  value,
  onChange,
  onSend,
  placeholder,
  sendAriaLabel,
  sending,
  autoFocus,
  footerNote,
}: ChatInputProps) {
  const disabled = sending || value.trim().length === 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea up to MAX_VISIBLE_ROWS lines, then let it scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight);
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const borderTop = parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = parseFloat(computed.borderBottomWidth) || 0;
    const maxHeight = lineHeight * MAX_VISIBLE_ROWS + paddingTop + paddingBottom + borderTop + borderBottom;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends; Shift+Enter inserts a newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled) onSend();
      }
    },
    [disabled, onSend],
  );

  return (
    <div>
      <div style={inputRowStyle}>
        <textarea
          ref={textareaRef}
          rows={1}
          style={{ ...textareaStyle, flex: 1, minWidth: 0 }}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={sending}
          autoFocus={autoFocus}
        />
        <button
          type='button'
          aria-label={sendAriaLabel}
          onClick={onSend}
          disabled={disabled}
          style={disabled ? sendIconButtonDisabledStyle : sendIconButtonStyle}
        >
          <SendIcon />
        </button>
      </div>
      {footerNote && (
        <p
          className='muted'
          style={{
            margin: '6px 0 0',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          {footerNote}
        </p>
      )}
    </div>
  );
}
