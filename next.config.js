/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,
	experimental: {
		runtime: 'edge',
		// Enable below when using React Server Components
		// serverComponents: true,
		// concurrentFeatures: true,
	},
};

module.exports = nextConfig;
