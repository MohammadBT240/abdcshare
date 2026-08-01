import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@abdcshare/shared', '@abdcshare/api-client'],
  // Avatar base64 uploads pass through the BFF proxy (~2 MB file → ~2.8 MB JSON).
  experimental: {
    middlewareClientMaxBodySize: '4mb',
  },
  async rewrites() {
    return [];
  },
};
export default config;
