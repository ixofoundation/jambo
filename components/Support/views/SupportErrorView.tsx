import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';

type SupportErrorViewProps = {
  message: string;
  onClose: () => void;
};

export default function SupportErrorView({ message, onClose }: SupportErrorViewProps) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <p style={{ marginTop: 0, color: 'var(--error-color)', fontSize: '14px' }}>{message}</p>
      <Button
        label='Close'
        onClick={onClose}
        bgColor={BUTTON_BG_COLOR.primary}
        borderColor={BUTTON_BORDER_COLOR.primary}
        color={BUTTON_COLOR.white}
        size={BUTTON_SIZE.mediumLarge}
        style={{
          padding: '12px 24px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--green-primary)',
          border: 'none',
          fontWeight: 700,
          boxShadow: 'var(--shadow-btn)',
        }}
      />
    </div>
  );
}
