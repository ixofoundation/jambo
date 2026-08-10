/** @type {import('next').NextConfig} */

// Keep in sync with the `lint` script in package.json. `next build` runs ESLint over
// these directories; without them Next 12 only lints `pages/` and `components/`,
// leaving utils/, hooks/, steps/, contexts/, types/ and constants/ unchecked.
const lintDirs = ['pages', 'components', 'utils', 'hooks', 'steps', 'contexts', 'types', 'constants', 'scripts'];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
  eslint: {
    dirs: lintDirs,
  },
  images: {
    domains: ['raw.githubusercontent.com', 'app.osmosis.zone', 's3.amazonaws.com'],
  },
};

module.exports = nextConfig;
