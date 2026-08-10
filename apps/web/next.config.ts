import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@abdcshare/shared', '@abdcshare/api-client'],
  // Avatar base64 uploads pass through the BFF proxy (~2 MB file → ~2.8 MB JSON).
  experimental: {
    middlewareClientMaxBodySize: '4mb',
  },
  async redirects() {
    return [
      { source: '/partner-reports', destination: '/reports', permanent: false },
      { source: '/partner-reports/new', destination: '/reports/new', permanent: false },
      { source: '/partner-reports/:id', destination: '/reports/:id', permanent: false },
    ];
  },
  async rewrites() {
    return [];
  },
};
export default config;
