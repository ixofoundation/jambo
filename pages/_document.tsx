import Document, { Html, Head, Main, NextScript } from 'next/document';

import config from '@constants/config.json';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta name='description' content={config.siteDescriptionMeta} />
          <link rel='icon' href='/favicon.ico' />

          {/* social */}
          <link rel='canonical' href={config.siteUrl} />
          <meta property='og:site_name' content={config.siteName} />
          <meta property='og:type' content='website' />
          <meta property='og:title' content={config.siteTitleMeta} />
          <meta property='og:description' content={config.siteDescriptionMeta} />
          <meta property='og:url' content={config.siteUrl} />
          <meta property='og:image' content={config.siteUrl + '/images/social/social.png'} />
          <meta name='twitter:title' content={config.siteTitleMeta} />
          <meta name='twitter:description' content={config.siteDescriptionMeta} />
          <meta name='twitter:url' content={config.siteUrl} />
          <meta name='twitter:card' content='summary_large_image' />
          <meta name='twitter:image' content={config.siteUrl + '/images/social/social.png'} />

          {/* Font Setup */}
          <link rel='preconnect' href='https://fonts.googleapis.com' />
          <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='true' />
          <link href={config.fontUrl} rel='stylesheet' />
          <style>{`:root { --font-family-name: ${config.fontName}; }`}</style>
        </Head>

        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
