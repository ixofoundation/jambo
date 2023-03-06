import React, { FC } from 'react';
import Header from 'next/head';
import { useRouter } from 'next/router';

import config from '@constants/config.json';

type HeadProps = {
  title: string;
  description?: string;
  // Image path from absolute public
  image?: string;
};

const Head: FC<HeadProps> = (props) => {
  const router = useRouter();

  return (
    <Header>
      <title>{props.title}</title>
      <meta property='og:title' content={props.title} />
      <meta name='twitter:title' content={props.title} />

      {props.description && (
        <>
          <meta name='description' content={props.description} />
          <meta property='og:description' content={props.description} />
          <meta name='twitter:description' content={props.description} />
        </>
      )}

      <link rel='canonical' href={config.siteUrl + router.asPath} />
      <meta property='og:url' content={config.siteUrl + router.asPath} />
      <meta name='twitter:url' content={config.siteUrl + router.asPath} />

      <meta property='og:type' content='website' />
      <meta name='twitter:card' content='summary_large_image' />

      {props.image && (
        <>
          <meta property='og:image' content={config.siteUrl + props.image} />
          <meta name='twitter:image' content={config.siteUrl + props.image} />
        </>
      )}
    </Header>
  );
};

export default Head;
