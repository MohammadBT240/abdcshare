import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (deploy/Dockerfile.web).
  output: 'standalone',
  transpilePackages: ['@abdcshare/shared', '@abdcshare/api-client'],
  // BFF proxy carries multipart uploads (company profiles / documents up to 100 MB)
  // and smaller avatar base64 JSON. Must stay ≥ nginx client_max_body_size.
  experimental: {
    middlewareClientMaxBodySize: '105mb',
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
