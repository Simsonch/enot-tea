import type { NextConfig } from 'next';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

function getApiUploadRemotePattern() {
  try {
    const url = new URL(apiBaseUrl);
    return {
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port || '',
      pathname: '/uploads/**',
    };
  } catch {
    return null;
  }
}

const apiUploadRemotePattern = getApiUploadRemotePattern();

const nextConfig: NextConfig = {
  images: apiUploadRemotePattern
    ? {
        remotePatterns: [apiUploadRemotePattern],
      }
    : undefined,
  async rewrites() {
    return [
      {
        source: '/products/:path*',
        destination: `${apiBaseUrl}/products/:path*`,
      },
      {
        source: '/orders/:path*',
        destination: `${apiBaseUrl}/orders/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiBaseUrl}/uploads/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${apiBaseUrl}/health/:path*`,
      },
    ];
  },
};

export default nextConfig;
