import { SUPPORT_INLINE_ALERT } from '@constants/support';

import { WarningTriangleIcon } from '../icons';
import { inlineAlertStyle } from '../styles';

export default function PrivacyAlert() {
  return (
    <div style={inlineAlertStyle} role='note'>
      <WarningTriangleIcon />
      <div>{SUPPORT_INLINE_ALERT}</div>
    </div>
  );
}
