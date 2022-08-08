import type { AppProps } from 'next/app';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ConfigProvider, ConfigContext } from '@contexts/config';
import { ReposProvider } from '@contexts/repositories';

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
	return (
		<SessionProvider session={session}>
			<ConfigProvider>
				<ReposProvider>
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
				</ReposProvider>
			</ConfigProvider>
		</SessionProvider>
	);
}

export default MyApp;
