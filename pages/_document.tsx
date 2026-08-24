import Document, { Html, Head, Main, NextScript } from 'next/document';

import config from '@constants/config.json';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta name='description' content={config.siteDescriptionMeta} />
          <link rel='icon' href='/favicon.ico' />
          <link rel='apple-touch-icon' href='/favicon.ico' />

          {/* social */}
          <link rel='canonical' href={config.siteUrl} />
          <meta property='og:site_name' content='JAMBO yoma' />
          <meta property='og:type' content='website' />
          <meta property='og:title' content='JAMBO yoma' />
          <meta property='og:description' content={config.siteDescriptionMeta} />
          <meta property='og:url' content={config.siteUrl} />
          <meta property='og:image' content={config.siteUrl + '/images/social/social.png'} />
          <meta name='twitter:title' content='JAMBO yoma' />
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
          <div
            hidden
            aria-hidden
            dangerouslySetInnerHTML={{
              __html: `<!--
THESIS: The opportunity is the interface — home is a deck of full-bleed task cards, one decision at a time; refuses the portal list-of-links default.
OWN-WORLD: Warm paper beige #f7f5eb, white 22px-radius cards, Nunito 700/800, aubergine #54365d brand, forest-green #387f6a pill actions, orange money, yellow earned-only; summoned dock, bottom sheets, quiet top toast pill.
STORY: A youth lands from Yoma, signs in with the same email, swipes real opportunities, applies, submits proof, gets paid — and trusts the loop.
FIRST VIEWPORT: yoma wordmark top-left with round icon actions right; one full-bleed opportunity card (photo, scrim, provider · Verified, 32px title, meta pills); pass/apply/save buttons beneath; dock pill bottom-centre.
FORM: Brief-pinned redesign — the designer's coded prototype (yoma-app, "The Deck · light edition") is the approved comp; pinned direction, no concept roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`,
            }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
