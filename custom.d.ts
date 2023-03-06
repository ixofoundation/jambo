declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

import { Window as KeplrWindow } from '@keplr-wallet/types';
import { OperaInterchain } from '@utils/opera';

declare global {
  interface Window extends KeplrWindow {}
  interface Window extends OperaInterchain {}
}
