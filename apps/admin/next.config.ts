import type { NextConfig } from 'next';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${apiBaseUrl}/auth/:path*`,
      },
      {
        source: '/orders/:path*',
        destination: `${apiBaseUrl}/orders/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${apiBaseUrl}/health/:path*`,
      },
    ];
  },
};

export default nextConfig;
