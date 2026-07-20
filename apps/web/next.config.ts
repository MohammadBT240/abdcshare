import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@abdcshare/shared'],
  async rewrites() {
    return [];
  },
};
export default config;
