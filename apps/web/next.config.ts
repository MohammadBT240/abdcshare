import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@abdcshare/shared', '@abdcshare/api-client'],
  async rewrites() {
    return [];
  },
};
export default config;
