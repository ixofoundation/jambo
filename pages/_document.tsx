import Document, { Html, Head, Main, NextScript } from 'next/document';

import config from '@constants/config.json';

class MyDocument extends Document {
	render() {
		return (
			<Html>
				<Head>
					<meta name="description" content="EarthDay" />
					<link rel="icon" href="/favicon.ico" />

					{/* Font Setup */}
					<link rel="preconnect" href="https://fonts.googleapis.com" />
					<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
					<link href={config.fontUrl} rel="stylesheet" />
					<style>{`:root { --font-family-name: ${config.fontName}; }`}</style>
				</Head>

				<body>
					<Main />
					<NextScript />
					<div id="modal-root"></div>
				</body>
			</Html>
		);
	}
}

export default MyDocument;
