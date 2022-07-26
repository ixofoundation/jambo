import type { AppProps } from 'next/app';
import Head from 'next/head';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ConfigProvider, ConfigContext } from '@contexts/config';

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<ConfigProvider>
			<ConfigContext.Consumer>
				{({ config }) => (
					<Head>
						<style>
							@import url({config.fontUrl});{`:root { --font-family-name: ${config.fontName} !important; }`}
						</style>
					</Head>
				)}
			</ConfigContext.Consumer>
			<Component {...pageProps} />
		</ConfigProvider>
	);
}

export default MyApp;
