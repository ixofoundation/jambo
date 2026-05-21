import { formatTimestamp } from '../format';
import { messageMetaRowStyle } from '../styles';

type MessageMetaRowProps = {
  senderLabel: string;
  timestamp: number;
  trailing?: string;
};

export default function MessageMetaRow({ senderLabel, timestamp, trailing }: MessageMetaRowProps) {
  return (
    <div style={messageMetaRowStyle}>
      <span>
        {senderLabel}
        {trailing ? ` ${trailing}` : ''}
      </span>
      <span>{formatTimestamp(timestamp)}</span>
    </div>
  );
}
