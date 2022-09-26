declare module '*.module.css' {
	const classes: { [key: string]: string };
	export default classes;
}

declare module '*.module.scss' {
	const classes: { [key: string]: string };
	export default classes;
}

import { Window as KeplrWindow } from '@keplr-wallet/types';

declare global {
	interface Window extends KeplrWindow {}
}
