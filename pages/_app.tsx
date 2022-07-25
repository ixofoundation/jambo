import type { AppProps } from 'next/app';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ConfigProvider } from '@contexts/config';

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<ConfigProvider>
			<Component {...pageProps} />
		</ConfigProvider>
	);
}

export default MyApp;
