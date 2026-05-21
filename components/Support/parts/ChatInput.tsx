import { useCallback } from 'react';

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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  return (
    <div>
      <div style={inputRowStyle}>
        <textarea
          style={{ ...textareaStyle, flex: 1, minWidth: 0 }}
          value={value}
          onChange={handleChange}
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
          style={{
            margin: '6px 0 0',
            fontSize: '11px',
            color: 'var(--text-secondary, #777)',
            lineHeight: 1.4,
          }}
        >
          {footerNote}
        </p>
      )}
    </div>
  );
}
