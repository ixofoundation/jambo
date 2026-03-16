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
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  experimental: {
    runtime: 'edge',
    // Enable below when using React Server Components
    // serverComponents: true,
    // concurrentFeatures: true,
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
