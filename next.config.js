/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,
	experimental: {
		runtime: 'edge',
		// serverComponents: true,
		// concurrentFeatures: true,
	},
};

module.exports = nextConfig;
