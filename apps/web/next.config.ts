import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The UI is a static bundle; Hono owns every API, auth, and file route.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@one-router/core', '@one-router/ui'],
  basePath,
};

export default nextConfig;
