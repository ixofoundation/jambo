const withTM = require('next-transpile-modules')([
  '@veramo/core',
  '@veramo/key-manager',
  '@veramo/kms-local',
  '@veramo/did-manager',
  '@veramo/did-resolver',
  '@veramo/credential-w3c',
  '@veramo/credential-ld',
  '@veramo/utils',
  '@veramo/core-types',
  'react-pdf',
  'pdfjs-dist',
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * The World Cleanup Day youth app (Openhands Network, `wcd/`) is served
   * under this domain as a sub-route: every request to /cleanup and below is
   * proxied server-side to the standalone deployment, whose own build carries
   * the same `/cleanup` prefix, so its pages, scripts, API routes and service
   * worker all resolve here too. Same origin as Jambo is the point: shared
   * browser storage, and one login once the session adapter lands.
   *
   * CLEANUP_APP_ORIGIN is read at build time (rewrites are compiled into the
   * routes manifest), one value per Vercel environment. Unset, the route
   * simply does not exist.
   */
  async rewrites() {
    const origin = (process.env.CLEANUP_APP_ORIGIN || '').replace(/\/$/, '');
    // Blank: no proxy, and pages/cleanup/[[...path]].tsx answers instead.
    if (!origin) return { beforeFiles: [] };
    // beforeFiles, so the proxy wins over that page wherever it is configured.
    return {
      beforeFiles: [
        { source: '/cleanup', destination: `${origin}/cleanup` },
        { source: '/cleanup/:path*', destination: `${origin}/cleanup/:path*` },
      ],
    };
  },
  swcMinify: false,
  experimental: {
    esmExternals: 'loose',
  },
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
      };
      // pdfjs-dist has an optional dependency on node-canvas that webpack
      // otherwise tries to resolve for browser builds.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        canvas: false,
      };
    }

    return config;
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['raw.githubusercontent.com', 'app.osmosis.zone', 's3.amazonaws.com'],
  },
};

module.exports = withTM(nextConfig);
