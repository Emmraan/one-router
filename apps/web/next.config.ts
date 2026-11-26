import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@one-router/core'],
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
};

export default nextConfig;
