import Document, { Html, Head, Main, NextScript } from 'next/document';

import config from '@constants/config.json';

class MyDocument extends Document {
	render() {
		return (
			<Html>
				<Head>
					<meta name="description" content="JAMBO" />
					<link rel="icon" href="/favicon.ico" />

					{/* social */}
					<link rel="canonical" href={config.siteUrl} />
					<meta property="og:site_name" content={config.siteName} />
					<meta property="og:type" content="website" />
					<meta property="og:title" content={config.siteName} />
					<meta property="og:description" content={config.about} />
					<meta property="og:url" content={config.siteUrl} />
					<meta property="og:image" content={config.siteName + '/images/social/social.png'} />
					<meta name="twitter:title" content={config.siteName} />
					<meta name="twitter:description" content={config.about} />
					<meta name="twitter:url" content={config.siteUrl} />
					<meta name="twitter:card" content="summary_large_image" />
					<meta name="twitter:image" content={config.siteName + '/images/social/social.png'} />

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
