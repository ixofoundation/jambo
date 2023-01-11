import type { AppProps } from 'next/app';

import '@styles/globals.scss';
import '@styles/variables.scss';
import 'react-toastify/dist/ReactToastify.css';
import { WalletProvider } from '@contexts/wallet';
import { ToastContainer } from '@components/Toast/Toast';

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<WalletProvider>
			<ToastContainer />
			<Component {...pageProps} />
		</WalletProvider>
	);
}

export default MyApp;
