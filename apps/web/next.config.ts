import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@customer-support/config', '@customer-support/types', '@customer-support/ui'],
};

export default nextConfig;
